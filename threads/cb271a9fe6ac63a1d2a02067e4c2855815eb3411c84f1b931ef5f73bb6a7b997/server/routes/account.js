const express = require('express');
const { db } = require('../db');
const {
  ApiError,
  SETTINGS,
  borrowBook,
  returnLoan,
  renewLoan,
  reserveBook,
  cancelReservation,
  daysOverdue,
  nowIso,
} = require('../lib/library');
const { listLoans, loanById, listReservations } = require('../lib/queries');
const { requireAuth } = require('./auth');

const router = express.Router();
router.use(requireAuth);

function ownLoan(req, id) {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(Number(id));
  if (!loan) throw new ApiError('LOAN_NOT_FOUND', 404);
  if (loan.user_id !== req.user.id) throw new ApiError('FORBIDDEN', 403);
  return loan;
}

router.get('/overview', (req, res) => {
  const userId = req.user.id;
  const now = nowIso();
  const active = db
    .prepare("SELECT * FROM loans WHERE user_id = ? AND status = 'active'")
    .all(userId);
  const overdue = active.filter((loan) => loan.due_at < now);
  const soon = Date.now() + 3 * 86400000;
  const dueSoon = active.filter(
    (loan) => loan.due_at >= now && new Date(loan.due_at).getTime() <= soon
  );
  const liveFine = overdue.reduce((sum, loan) => sum + daysOverdue(loan.due_at) * SETTINGS.FINE_PER_DAY, 0);
  const unpaid = db
    .prepare(
      "SELECT COALESCE(SUM(fine_amount), 0) AS total FROM loans WHERE user_id = ? AND fine_status = 'unpaid'"
    )
    .get(userId).total;
  res.json({
    overview: {
      active_loans: active.length,
      overdue: overdue.length,
      due_soon: dueSoon.length,
      waiting: db
        .prepare("SELECT COUNT(*) AS c FROM reservations WHERE user_id = ? AND status = 'waiting'")
        .get(userId).c,
      ready: db
        .prepare("SELECT COUNT(*) AS c FROM reservations WHERE user_id = ? AND status = 'ready'")
        .get(userId).c,
      unpaid_fines: unpaid,
      live_fine: liveFine,
      favorites: db.prepare('SELECT COUNT(*) AS c FROM favorites WHERE user_id = ?').get(userId).c,
      borrowed_total: db.prepare('SELECT COUNT(*) AS c FROM loans WHERE user_id = ?').get(userId).c,
      returned_total: db
        .prepare("SELECT COUNT(*) AS c FROM loans WHERE user_id = ? AND status = 'returned'")
        .get(userId).c,
      limit: SETTINGS.MAX_ACTIVE_LOANS,
    },
    settings: SETTINGS,
  });
});

router.get('/loans', (req, res) => {
  const status = ['active', 'returned', 'overdue'].includes(String(req.query.status))
    ? String(req.query.status)
    : 'all';
  const data = listLoans(db, {
    userId: req.user.id,
    status,
    limit: Number(req.query.limit) || 100,
    page: Number(req.query.page) || 1,
  });
  res.json(data);
});

router.post('/loans', (req, res, next) => {
  try {
    const bookId = Number(req.body.bookId);
    if (!Number.isInteger(bookId)) throw new ApiError('INVALID_INPUT', 400, { field: 'bookId' });
    const loan = borrowBook(db, req.user.id, bookId, { handledBy: req.user.id });
    res.status(201).json({ loan: loanById(db, loan.id) });
  } catch (error) {
    next(error);
  }
});

router.post('/loans/:id/renew', (req, res, next) => {
  try {
    const loan = ownLoan(req, req.params.id);
    renewLoan(db, loan.id);
    res.json({ loan: loanById(db, loan.id) });
  } catch (error) {
    next(error);
  }
});

router.post('/loans/:id/return', (req, res, next) => {
  try {
    const loan = ownLoan(req, req.params.id);
    const updated = returnLoan(db, loan.id, req.user.id);
    res.json({ loan: loanById(db, loan.id), fine: updated.fine_amount });
  } catch (error) {
    next(error);
  }
});

router.get('/reservations', (req, res) => {
  const status = String(req.query.status || 'active');
  res.json(
    listReservations(db, {
      userId: req.user.id,
      activeOnly: status === 'active',
      status: status === 'active' ? 'all' : status,
      limit: 100,
    })
  );
});

router.post('/reservations', (req, res, next) => {
  try {
    const bookId = Number(req.body.bookId);
    if (!Number.isInteger(bookId)) throw new ApiError('INVALID_INPUT', 400, { field: 'bookId' });
    const created = reserveBook(db, req.user.id, bookId);
    const rows = listReservations(db, { userId: req.user.id, activeOnly: true });
    res.status(201).json({
      reservation: rows.items.find((item) => item.id === created.id) || null,
      status: created.status,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/reservations/:id', (req, res, next) => {
  try {
    cancelReservation(db, Number(req.params.id), req.user.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/fines', (req, res) => {
  const items = db
    .prepare(
      `SELECT l.id, l.book_id, l.borrowed_at, l.due_at, l.returned_at, l.fine_amount, l.fine_status,
        l.status, l.settled_at, b.title AS book_title, b.slug AS book_slug, b.author AS book_author,
        b.cover_tone AS book_cover_tone, b.cover_url AS book_cover_url
       FROM loans l JOIN books b ON b.id = l.book_id
       WHERE l.user_id = ? AND (l.fine_status <> 'none' OR (l.status = 'active' AND l.due_at < ?))
       ORDER BY (l.fine_status = 'unpaid') DESC, l.due_at DESC`
    )
    .all(req.user.id, nowIso())
    .map((row) => {
      const overdue = row.status === 'active' ? daysOverdue(row.due_at) : 0;
      const amount = row.status === 'active' ? overdue * SETTINGS.FINE_PER_DAY : row.fine_amount;
      return { ...row, overdue_days: overdue, amount, is_live: row.status === 'active' };
    });
  res.json({
    items,
    unpaid_total: items.filter((i) => i.fine_status === 'unpaid').reduce((s, i) => s + i.amount, 0),
    live_total: items.filter((i) => i.is_live).reduce((s, i) => s + i.amount, 0),
    settings: SETTINGS,
  });
});

router.post('/fines/:loanId/pay', (req, res, next) => {
  try {
    const loan = ownLoan(req, req.params.loanId);
    if (loan.fine_status !== 'unpaid') throw new ApiError('FINE_NOT_PAYABLE', 409);
    db.prepare("UPDATE loans SET fine_status = 'paid', settled_at = ? WHERE id = ?").run(
      nowIso(),
      loan.id
    );
    res.json({ ok: true, paid: loan.fine_amount });
  } catch (error) {
    next(error);
  }
});

module.exports = { router };
