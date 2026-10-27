const SETTINGS = {
  LOAN_DAYS: 14,
  MAX_ACTIVE_LOANS: 5,
  MAX_RENEWALS: 2,
  RENEW_DAYS: 7,
  FINE_PER_DAY: 5000,
  HOLD_HOURS: 48,
};

const DAY = 86400000;

class ApiError extends Error {
  constructor(code, status = 400, meta = {}) {
    super(code);
    this.code = code;
    this.status = status;
    this.meta = meta;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function addDays(iso, days) {
  return new Date(new Date(iso).getTime() + days * DAY).toISOString();
}

function addHours(iso, hours) {
  return new Date(new Date(iso).getTime() + hours * 3600000).toISOString();
}

function daysOverdue(dueAt, now = Date.now()) {
  const diff = now - new Date(dueAt).getTime();
  return diff > 0 ? Math.ceil(diff / DAY) : 0;
}

function daysLeft(dueAt, now = Date.now()) {
  return Math.ceil((new Date(dueAt).getTime() - now) / DAY);
}

function loanOut(row, now = Date.now()) {
  if (!row) return null;
  const overdue = row.status === 'active' ? daysOverdue(row.due_at, now) : 0;
  return {
    ...row,
    overdue_days: overdue,
    days_left: row.status === 'active' ? daysLeft(row.due_at, now) : null,
    live_fine: overdue * SETTINGS.FINE_PER_DAY,
    is_overdue: overdue > 0,
  };
}

/** available = total copies - active loans - copies held for ready reservations */
function syncAvailability(db, bookId) {
  const book = db.prepare('SELECT id, total_copies FROM books WHERE id = ?').get(bookId);
  if (!book) return;
  const loans = db
    .prepare("SELECT COUNT(*) AS c FROM loans WHERE book_id = ? AND status = 'active'")
    .get(bookId).c;
  const holds = db
    .prepare("SELECT COUNT(*) AS c FROM reservations WHERE book_id = ? AND status = 'ready'")
    .get(bookId).c;
  const available = Math.max(0, book.total_copies - loans - holds);
  db.prepare('UPDATE books SET available_copies = ? WHERE id = ?').run(available, bookId);
}

function promoteHolds(db, bookId) {
  for (let guard = 0; guard < 25; guard += 1) {
    const book = db.prepare('SELECT available_copies FROM books WHERE id = ?').get(bookId);
    if (!book || book.available_copies <= 0) return;
    const next = db
      .prepare(
        "SELECT id FROM reservations WHERE book_id = ? AND status = 'waiting' ORDER BY created_at ASC, id ASC LIMIT 1"
      )
      .get(bookId);
    if (!next) return;
    const now = nowIso();
    db.prepare(
      "UPDATE reservations SET status = 'ready', ready_at = ?, expires_at = ? WHERE id = ?"
    ).run(now, addHours(now, SETTINGS.HOLD_HOURS), next.id);
    syncAvailability(db, bookId);
  }
}

function sweep(db) {
  const now = nowIso();
  const expired = db
    .prepare("SELECT id, book_id FROM reservations WHERE status = 'ready' AND expires_at IS NOT NULL AND expires_at < ?")
    .all(now);
  if (!expired.length) return;
  for (const row of expired) {
    db.prepare("UPDATE reservations SET status = 'expired' WHERE id = ?").run(row.id);
    syncAvailability(db, row.book_id);
    promoteHolds(db, row.book_id);
  }
}

function getUser(db, id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function getBook(db, id) {
  return db.prepare('SELECT * FROM books WHERE id = ?').get(id);
}

function borrowBook(db, userId, bookId, options = {}) {
  sweep(db);
  const user = getUser(db, userId);
  if (!user) throw new ApiError('MEMBER_NOT_FOUND', 404);
  if (user.status !== 'active') throw new ApiError('ACCOUNT_SUSPENDED', 403);
  const book = getBook(db, bookId);
  if (!book) throw new ApiError('BOOK_NOT_FOUND', 404);

  const open = db
    .prepare("SELECT id FROM loans WHERE user_id = ? AND book_id = ? AND status = 'active'")
    .get(userId, bookId);
  if (open) throw new ApiError('ALREADY_BORROWED', 409);

  const activeCount = db
    .prepare("SELECT COUNT(*) AS c FROM loans WHERE user_id = ? AND status = 'active'")
    .get(userId).c;
  if (activeCount >= SETTINGS.MAX_ACTIVE_LOANS) {
    throw new ApiError('LOAN_LIMIT', 409, { max: SETTINGS.MAX_ACTIVE_LOANS });
  }

  const hold = db
    .prepare(
      "SELECT * FROM reservations WHERE user_id = ? AND book_id = ? AND status = 'ready' AND (expires_at IS NULL OR expires_at > ?)"
    )
    .get(userId, bookId, nowIso());

  if (!hold && book.available_copies <= 0) throw new ApiError('BOOK_UNAVAILABLE', 409);

  if (!hold) {
    const queue = db
      .prepare(
        "SELECT COUNT(*) AS c FROM reservations WHERE book_id = ? AND status IN ('waiting', 'ready')"
      )
      .get(bookId).c;
    if (queue > 0) throw new ApiError('BOOK_RESERVED_QUEUE', 409);
  }

  const now = nowIso();
  const days = Number(options.days) > 0 ? Math.min(90, Number(options.days)) : SETTINGS.LOAN_DAYS;
  const info = db
    .prepare(
      `INSERT INTO loans (user_id, book_id, borrowed_at, due_at, status, handled_by)
       VALUES (?, ?, ?, ?, 'active', ?)`
    )
    .run(userId, bookId, now, addDays(now, days), options.handledBy || null);

  if (hold) db.prepare("UPDATE reservations SET status = 'fulfilled' WHERE id = ?").run(hold.id);
  syncAvailability(db, bookId);
  return db.prepare('SELECT * FROM loans WHERE id = ?').get(info.lastInsertRowid);
}

function returnLoan(db, loanId, actorId = null) {
  sweep(db);
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
  if (!loan) throw new ApiError('LOAN_NOT_FOUND', 404);
  if (loan.status !== 'active') throw new ApiError('LOAN_ALREADY_RETURNED', 409);

  const now = nowIso();
  const overdue = daysOverdue(loan.due_at);
  const fine = overdue * SETTINGS.FINE_PER_DAY;
  db.prepare(
    `UPDATE loans SET status = 'returned', returned_at = ?, fine_amount = ?,
     fine_status = ?, handled_by = COALESCE(?, handled_by) WHERE id = ?`
  ).run(now, fine, fine > 0 ? 'unpaid' : 'none', actorId, loanId);

  syncAvailability(db, loan.book_id);
  promoteHolds(db, loan.book_id);
  return db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
}

function renewLoan(db, loanId) {
  sweep(db);
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
  if (!loan) throw new ApiError('LOAN_NOT_FOUND', 404);
  if (loan.status !== 'active') throw new ApiError('LOAN_ALREADY_RETURNED', 409);
  if (daysOverdue(loan.due_at) > 0) throw new ApiError('LOAN_OVERDUE', 409);
  if (loan.renewed_count >= SETTINGS.MAX_RENEWALS) throw new ApiError('RENEW_LIMIT', 409);
  const waiting = db
    .prepare("SELECT COUNT(*) AS c FROM reservations WHERE book_id = ? AND status IN ('waiting', 'ready')")
    .get(loan.book_id).c;
  if (waiting > 0) throw new ApiError('RENEW_BLOCKED', 409);

  db.prepare('UPDATE loans SET due_at = ?, renewed_count = renewed_count + 1 WHERE id = ?').run(
    addDays(loan.due_at, SETTINGS.RENEW_DAYS),
    loanId
  );
  return db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId);
}

function reserveBook(db, userId, bookId) {
  sweep(db);
  const user = getUser(db, userId);
  if (!user) throw new ApiError('MEMBER_NOT_FOUND', 404);
  if (user.status !== 'active') throw new ApiError('ACCOUNT_SUSPENDED', 403);
  const book = getBook(db, bookId);
  if (!book) throw new ApiError('BOOK_NOT_FOUND', 404);

  const open = db
    .prepare("SELECT id FROM loans WHERE user_id = ? AND book_id = ? AND status = 'active'")
    .get(userId, bookId);
  if (open) throw new ApiError('ALREADY_BORROWED', 409);
  const existing = db
    .prepare("SELECT id FROM reservations WHERE user_id = ? AND book_id = ? AND status IN ('waiting', 'ready')")
    .get(userId, bookId);
  if (existing) throw new ApiError('ALREADY_RESERVED', 409);

  syncAvailability(db, bookId);
  const fresh = getBook(db, bookId);
  if (fresh.available_copies > 0) {
    const waiting = db
      .prepare("SELECT COUNT(*) AS c FROM reservations WHERE book_id = ? AND status = 'waiting'")
      .get(bookId).c;
    if (waiting === 0) throw new ApiError('BOOK_AVAILABLE', 409);
  }

  const now = nowIso();
  const info = db
    .prepare("INSERT INTO reservations (user_id, book_id, created_at, status) VALUES (?, ?, ?, 'waiting')")
    .run(userId, bookId, now);
  promoteHolds(db, bookId);
  return db.prepare('SELECT * FROM reservations WHERE id = ?').get(info.lastInsertRowid);
}

function cancelReservation(db, reservationId, userId = null) {
  const res = db.prepare('SELECT * FROM reservations WHERE id = ?').get(reservationId);
  if (!res) throw new ApiError('RESERVATION_NOT_FOUND', 404);
  if (userId && res.user_id !== userId) throw new ApiError('FORBIDDEN', 403);
  if (!['waiting', 'ready'].includes(res.status)) throw new ApiError('RESERVATION_NOT_ACTIVE', 409);
  db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(reservationId);
  syncAvailability(db, res.book_id);
  promoteHolds(db, res.book_id);
  return res;
}

function fulfillReservation(db, reservationId, actorId = null) {
  const res = db.prepare('SELECT * FROM reservations WHERE id = ?').get(reservationId);
  if (!res) throw new ApiError('RESERVATION_NOT_FOUND', 404);
  if (!['waiting', 'ready'].includes(res.status)) throw new ApiError('RESERVATION_NOT_ACTIVE', 409);
  // only a held copy can be checked out; waiting means every copy is still out on loan
  if (res.status !== 'ready') throw new ApiError('RESERVATION_NOT_READY', 409);
  return borrowBook(db, res.user_id, res.book_id, { handledBy: actorId });
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    phone: user.phone,
    address: user.address,
    created_at: user.created_at,
  };
}

module.exports = {
  SETTINGS,
  DAY,
  ApiError,
  nowIso,
  addDays,
  addHours,
  daysOverdue,
  daysLeft,
  loanOut,
  syncAvailability,
  promoteHolds,
  sweep,
  borrowBook,
  returnLoan,
  renewLoan,
  reserveBook,
  cancelReservation,
  fulfillReservation,
  publicUser,
  getUser,
  getBook,
};
