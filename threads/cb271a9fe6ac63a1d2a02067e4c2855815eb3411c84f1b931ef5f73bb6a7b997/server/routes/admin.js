const express = require('express');
const { db } = require('../db');
const {
  ApiError,
  SETTINGS,
  borrowBook,
  returnLoan,
  renewLoan,
  cancelReservation,
  fulfillReservation,
  syncAvailability,
  promoteHolds,
  nowIso,
} = require('../lib/library');
const { BOOK_FIELDS, listLoans, loanById, listReservations } = require('../lib/queries');
const { requireAuth } = require('./auth');

const router = express.Router();

router.use(requireAuth, (req, res, next) => {
  if (req.user.role !== 'admin') return next(new ApiError('FORBIDDEN', 403));
  next();
});

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'sach';
}

function uniqueSlug(base, excludeId = null) {
  let slug = base;
  let n = 2;
  while (
    db
      .prepare(`SELECT id FROM books WHERE slug = ? ${excludeId ? 'AND id <> ?' : ''}`)
      .get(...(excludeId ? [slug, excludeId] : [slug]))
  ) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

function intOrNull(value, min, max) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function requiredInt(value, min, max, field) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ApiError('INVALID_INPUT', 400, { field, min, max });
  }
  return n;
}

function text(value, max) {
  const out = String(value == null ? '' : value).trim();
  return out ? out.slice(0, max) : null;
}

function categoryExists(id) {
  if (!id) return null;
  return db.prepare('SELECT id FROM categories WHERE id = ?').get(Number(id)) ? Number(id) : null;
}

router.get('/overview', (req, res) => {
  const one = (sql, ...params) => db.prepare(sql).get(...params).c;
  const now = nowIso();
  const series = [];
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    series.push({
      key,
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      loans: one("SELECT COUNT(*) AS c FROM loans WHERE substr(borrowed_at, 1, 7) = ?", key),
      returns: one("SELECT COUNT(*) AS c FROM loans WHERE returned_at IS NOT NULL AND substr(returned_at, 1, 7) = ?", key),
    });
  }

  const popular = db
    .prepare(
      `SELECT b.id, b.slug, b.title, b.author, b.cover_tone, b.cover_url,
        (SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id) AS loan_count,
        (SELECT ROUND(AVG(rating), 1) FROM reviews r WHERE r.book_id = b.id) AS rating_avg
       FROM books b ORDER BY loan_count DESC, b.title ASC LIMIT 5`
    )
    .all();

  const recent = db
    .prepare(
      `SELECT l.id, l.status, l.borrowed_at, l.due_at, l.returned_at, l.fine_amount, l.fine_status,
        b.title AS book_title, b.slug AS book_slug, b.cover_tone AS book_cover_tone,
        u.name AS user_name, u.email AS user_email
       FROM loans l JOIN books b ON b.id = l.book_id JOIN users u ON u.id = l.user_id
       ORDER BY l.borrowed_at DESC LIMIT 8`
    )
    .all();

  res.json({
    stats: {
      books: one('SELECT COUNT(*) AS c FROM books'),
      copies: db.prepare('SELECT COALESCE(SUM(total_copies), 0) AS c FROM books').get().c,
      available: db.prepare('SELECT COALESCE(SUM(available_copies), 0) AS c FROM books').get().c,
      members: one("SELECT COUNT(*) AS c FROM users WHERE role = 'member'"),
      suspended: one("SELECT COUNT(*) AS c FROM users WHERE status = 'suspended'"),
      new_members: one('SELECT COUNT(*) AS c FROM users WHERE created_at >= ?', new Date(Date.now() - 30 * 86400000).toISOString()),
      active_loans: one("SELECT COUNT(*) AS c FROM loans WHERE status = 'active'"),
      overdue: one("SELECT COUNT(*) AS c FROM loans WHERE status = 'active' AND due_at < ?", now),
      returns_30d: one('SELECT COUNT(*) AS c FROM loans WHERE returned_at IS NOT NULL AND returned_at >= ?', new Date(Date.now() - 30 * 86400000).toISOString()),
      waiting: one("SELECT COUNT(*) AS c FROM reservations WHERE status = 'waiting'"),
      ready: one("SELECT COUNT(*) AS c FROM reservations WHERE status = 'ready'"),
      reviews: one('SELECT COUNT(*) AS c FROM reviews'),
      unpaid_fines: db.prepare("SELECT COALESCE(SUM(fine_amount), 0) AS c FROM loans WHERE fine_status = 'unpaid'").get().c,
      unpaid_count: one("SELECT COUNT(*) AS c FROM loans WHERE fine_status = 'unpaid'"),
      collected_fines: db.prepare("SELECT COALESCE(SUM(fine_amount), 0) AS c FROM loans WHERE fine_status = 'paid'").get().c,
    },
    monthly: series,
    popular,
    recent,
    settings: SETTINGS,
  });
});

router.get('/books', (req, res) => {
  const q = String(req.query.q || '').trim();
  const where = [];
  const params = {};
  if (q) {
    where.push('(b.title LIKE @q OR b.author LIKE @q OR b.isbn LIKE @q OR b.slug LIKE @q)');
    params.q = `%${q}%`;
  }
  if (req.query.category) {
    where.push('c.slug = @category');
    params.category = String(req.query.category);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = 200;
  const items = db
    .prepare(
      `SELECT ${BOOK_FIELDS} FROM books b LEFT JOIN categories c ON c.id = b.category_id
       ${whereSql} ORDER BY b.created_at DESC LIMIT ${limit}`
    )
    .all(params);
  res.json({ items, total: items.length });
});

router.post('/books', (req, res, next) => {
  try {
    const body = req.body || {};
    const title = text(body.title, 200);
    const author = text(body.author, 160);
    if (!title) throw new ApiError('INVALID_TITLE', 400);
    if (!author) throw new ApiError('INVALID_AUTHOR', 400);
    const total =
      body.total_copies == null || body.total_copies === ''
        ? 1
        : requiredInt(body.total_copies, 1, 999, 'total_copies');
    const language = body.language === 'en' ? 'en' : 'vi';
    const info = db
      .prepare(
        `INSERT INTO books (slug, title, author, isbn, publisher, year, category_id, language, pages,
          description_vi, description_en, cover_url, cover_tone, total_copies, available_copies, shelf, featured, created_at)
         VALUES (@slug, @title, @author, @isbn, @publisher, @year, @category_id, @language, @pages,
          @description_vi, @description_en, @cover_url, @cover_tone, @total_copies, @total_copies, @shelf, @featured, @created_at)`
      )
      .run({
        slug: uniqueSlug(slugify(body.slug || title)),
        title,
        author,
        isbn: text(body.isbn, 40),
        publisher: text(body.publisher, 160),
        year: intOrNull(body.year, 0, 2100),
        category_id: categoryExists(body.category_id),
        language,
        pages: intOrNull(body.pages, 1, 20000),
        description_vi: text(body.description_vi, 4000),
        description_en: text(body.description_en, 4000),
        cover_url: text(body.cover_url, 500),
        cover_tone: intOrNull(body.cover_tone, 0, 7) || 0,
        total_copies: total,
        shelf: text(body.shelf, 40),
        featured: body.featured ? 1 : 0,
        created_at: nowIso(),
      });
    const book = db
      .prepare(`SELECT ${BOOK_FIELDS} FROM books b LEFT JOIN categories c ON c.id = b.category_id WHERE b.id = ?`)
      .get(info.lastInsertRowid);
    res.status(201).json({ book });
  } catch (error) {
    next(error);
  }
});

router.patch('/books/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(id);
    if (!book) throw new ApiError('BOOK_NOT_FOUND', 404);
    const body = req.body || {};

    const fields = {};
    if (body.title !== undefined) {
      fields.title = text(body.title, 200);
      if (!fields.title) throw new ApiError('INVALID_TITLE', 400);
    }
    if (body.author !== undefined) {
      fields.author = text(body.author, 160);
      if (!fields.author) throw new ApiError('INVALID_AUTHOR', 400);
    }
    if (body.isbn !== undefined) fields.isbn = text(body.isbn, 40);
    if (body.publisher !== undefined) fields.publisher = text(body.publisher, 160);
    if (body.year !== undefined) fields.year = intOrNull(body.year, 0, 2100);
    if (body.category_id !== undefined) fields.category_id = categoryExists(body.category_id);
    if (body.language !== undefined) fields.language = body.language === 'en' ? 'en' : 'vi';
    if (body.pages !== undefined) fields.pages = intOrNull(body.pages, 1, 20000);
    if (body.description_vi !== undefined) fields.description_vi = text(body.description_vi, 4000);
    if (body.description_en !== undefined) fields.description_en = text(body.description_en, 4000);
    if (body.cover_url !== undefined) fields.cover_url = text(body.cover_url, 500);
    if (body.cover_tone !== undefined) fields.cover_tone = intOrNull(body.cover_tone, 0, 7) || 0;
    if (body.shelf !== undefined) fields.shelf = text(body.shelf, 40);
    if (body.featured !== undefined) fields.featured = body.featured ? 1 : 0;
    if (body.slug !== undefined && text(body.slug, 70)) {
      fields.slug = uniqueSlug(slugify(body.slug), id);
    }
    if (body.total_copies !== undefined) {
      const total = requiredInt(body.total_copies, 1, 999, 'total_copies');
      const locked =
        db.prepare("SELECT COUNT(*) AS c FROM loans WHERE book_id = ? AND status = 'active'").get(id).c +
        db.prepare("SELECT COUNT(*) AS c FROM reservations WHERE book_id = ? AND status = 'ready'").get(id).c;
      if (total < locked) throw new ApiError('COPIES_TOO_LOW', 409, { minimum: locked });
      fields.total_copies = total;
    }

    const keys = Object.keys(fields);
    if (keys.length) {
      db.prepare(
        `UPDATE books SET ${keys.map((k) => `${k} = @${k}`).join(', ')} WHERE id = @id`
      ).run({ ...fields, id });
    }
    syncAvailability(db, id);
    promoteHolds(db, id);
    const updated = db
      .prepare(`SELECT ${BOOK_FIELDS} FROM books b LEFT JOIN categories c ON c.id = b.category_id WHERE b.id = ?`)
      .get(id);
    res.json({ book: updated });
  } catch (error) {
    next(error);
  }
});

router.delete('/books/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const book = db.prepare('SELECT id FROM books WHERE id = ?').get(id);
    if (!book) throw new ApiError('BOOK_NOT_FOUND', 404);
    const history = db.prepare('SELECT COUNT(*) AS c FROM loans WHERE book_id = ?').get(id).c;
    if (history) throw new ApiError('BOOK_HAS_HISTORY', 409, { loans: history });
    db.prepare('DELETE FROM books WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/members', (req, res) => {
  const q = String(req.query.q || '').trim();
  const params = {};
  let whereSql = '';
  if (q) {
    whereSql = 'WHERE (u.name LIKE @q OR u.email LIKE @q OR u.phone LIKE @q)';
    params.q = `%${q}%`;
  }
  const items = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.status, u.phone, u.address, u.created_at,
        (SELECT COUNT(*) FROM loans l WHERE l.user_id = u.id AND l.status = 'active') AS active_loans,
        (SELECT COUNT(*) FROM loans l WHERE l.user_id = u.id) AS total_loans,
        (SELECT COUNT(*) FROM loans l WHERE l.user_id = u.id AND l.status = 'active' AND l.due_at < @now) AS overdue,
        (SELECT COALESCE(SUM(l.fine_amount), 0) FROM loans l WHERE l.user_id = u.id AND l.fine_status = 'unpaid') AS unpaid_fines
       FROM users u ${whereSql} ORDER BY u.created_at DESC LIMIT 300`
    )
    .all({ ...params, now: nowIso() });
  res.json({ items, total: items.length });
});

router.patch('/members/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const member = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!member) throw new ApiError('MEMBER_NOT_FOUND', 404);
    const body = req.body || {};
    const admins = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND status = 'active'").get().c;

    const fields = {};
    if (body.name !== undefined) {
      const name = text(body.name, 80);
      if (!name) throw new ApiError('INVALID_NAME', 400);
      fields.name = name;
    }
    if (body.phone !== undefined) fields.phone = text(body.phone, 30);
    if (body.address !== undefined) fields.address = text(body.address, 200);
    if (body.role !== undefined) {
      const role = body.role === 'admin' ? 'admin' : 'member';
      if (member.id === req.user.id && role !== member.role) throw new ApiError('CANNOT_CHANGE_SELF', 409);
      if (member.role === 'admin' && role === 'member' && admins <= 1) throw new ApiError('LAST_ADMIN', 409);
      fields.role = role;
    }
    if (body.status !== undefined) {
      const status = body.status === 'suspended' ? 'suspended' : 'active';
      if (member.id === req.user.id) throw new ApiError('CANNOT_CHANGE_SELF', 409);
      if (member.role === 'admin' && status === 'suspended' && admins <= 1) throw new ApiError('LAST_ADMIN', 409);
      fields.status = status;
    }

    const keys = Object.keys(fields);
    if (keys.length) {
      db.prepare(`UPDATE users SET ${keys.map((k) => `${k} = @${k}`).join(', ')} WHERE id = @id`).run({
        ...fields,
        id,
      });
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/loans', (req, res) => {
  const status = String(req.query.status || 'all');
  res.json(
    listLoans(db, {
      status: ['active', 'overdue', 'returned', 'unpaid_fines'].includes(status) ? status : 'all',
      q: req.query.q,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 40,
    })
  );
});

router.post('/loans', (req, res, next) => {
  try {
    const userId = Number(req.body.userId);
    const bookId = Number(req.body.bookId);
    if (!Number.isInteger(userId) || !Number.isInteger(bookId)) {
      throw new ApiError('INVALID_INPUT', 400, { field: 'userId/bookId' });
    }
    const loan = borrowBook(db, userId, bookId, {
      days: Number(req.body.days) || SETTINGS.LOAN_DAYS,
      handledBy: req.user.id,
    });
    res.status(201).json({ loan: loanById(db, loan.id) });
  } catch (error) {
    next(error);
  }
});

router.post('/loans/:id/return', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT id FROM loans WHERE id = ?').get(id)) throw new ApiError('LOAN_NOT_FOUND', 404);
    const updated = returnLoan(db, id, req.user.id);
    res.json({ loan: loanById(db, id), fine: updated.fine_amount });
  } catch (error) {
    next(error);
  }
});

router.post('/loans/:id/renew', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT id FROM loans WHERE id = ?').get(id)) throw new ApiError('LOAN_NOT_FOUND', 404);
    renewLoan(db, id);
    res.json({ loan: loanById(db, id) });
  } catch (error) {
    next(error);
  }
});

router.get('/reservations', (req, res) => {
  const status = String(req.query.status || 'active');
  res.json(
    listReservations(db, {
      status: status === 'active' ? 'all' : status,
      activeOnly: status === 'active',
      q: req.query.q,
      limit: 200,
    })
  );
});

router.post('/reservations/:id/fulfill', (req, res, next) => {
  try {
    const loan = fulfillReservation(db, Number(req.params.id), req.user.id);
    res.json({ loan: loanById(db, loan.id) });
  } catch (error) {
    next(error);
  }
});

router.post('/reservations/:id/cancel', (req, res, next) => {
  try {
    cancelReservation(db, Number(req.params.id));
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/fines', (req, res) => {
  const status = String(req.query.status || 'unpaid');
  const where = [];
  const params = { now: nowIso() };
  if (status === 'unpaid') where.push("l.fine_status = 'unpaid'");
  if (status === 'paid') where.push("l.fine_status = 'paid'");
  if (status === 'waived') where.push("l.fine_status = 'waived'");
  if (status === 'live') where.push("l.status = 'active' AND l.due_at < @now");
  let sql = `SELECT l.id, l.user_id, l.book_id, l.borrowed_at, l.due_at, l.returned_at, l.fine_amount,
      l.fine_status, l.status, l.settled_at, b.title AS book_title, b.slug AS book_slug,
      u.name AS user_name, u.email AS user_email
     FROM loans l JOIN books b ON b.id = l.book_id JOIN users u ON u.id = l.user_id`;
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  // live overdue loans live in a separate query so the status filter stays predictable
  let items = db.prepare(sql).all(params);
  if (status === 'unpaid') {
    const live = db
      .prepare(
        `SELECT l.id, l.user_id, l.book_id, l.borrowed_at, l.due_at, l.returned_at, l.fine_amount,
          l.fine_status, l.status, l.settled_at, b.title AS book_title, b.slug AS book_slug,
          u.name AS user_name, u.email AS user_email
         FROM loans l JOIN books b ON b.id = l.book_id JOIN users u ON u.id = l.user_id
         WHERE l.status = 'active' AND l.due_at < @now`
      )
      .all(params);
    items = [...items, ...live];
  }
  items = items
    .map((row) => {
      const overdue = row.status === 'active' ? Math.max(0, Math.ceil((Date.now() - new Date(row.due_at).getTime()) / 86400000)) : 0;
      return {
        ...row,
        overdue_days: overdue,
        amount: row.status === 'active' ? overdue * SETTINGS.FINE_PER_DAY : row.fine_amount,
        is_live: row.status === 'active',
      };
    })
    .sort((a, b) => b.amount - a.amount);
  res.json({
    items,
    unpaid_total: items.filter((i) => i.fine_status === 'unpaid').reduce((s, i) => s + i.amount, 0),
    live_total: items.filter((i) => i.is_live).reduce((s, i) => s + i.amount, 0),
    settings: SETTINGS,
  });
});

router.post('/fines/:loanId/pay', (req, res, next) => {
  try {
    const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(Number(req.params.loanId));
    if (!loan) throw new ApiError('LOAN_NOT_FOUND', 404);
    if (loan.fine_status !== 'unpaid') throw new ApiError('FINE_NOT_PAYABLE', 409);
    db.prepare("UPDATE loans SET fine_status = 'paid', settled_at = ? WHERE id = ?").run(nowIso(), loan.id);
    res.json({ ok: true, paid: loan.fine_amount });
  } catch (error) {
    next(error);
  }
});

router.post('/fines/:loanId/waive', (req, res, next) => {
  try {
    const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(Number(req.params.loanId));
    if (!loan) throw new ApiError('LOAN_NOT_FOUND', 404);
    if (loan.fine_status !== 'unpaid') throw new ApiError('FINE_NOT_PAYABLE', 409);
    db.prepare("UPDATE loans SET fine_status = 'waived', settled_at = ? WHERE id = ?").run(nowIso(), loan.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/categories', (req, res) => {
  const items = db
    .prepare(
      `SELECT c.id, c.slug, c.name_vi, c.name_en,
        (SELECT COUNT(*) FROM books b WHERE b.category_id = c.id) AS book_count
       FROM categories c ORDER BY c.name_vi COLLATE NOCASE ASC`
    )
    .all();
  res.json({ items });
});

router.post('/categories', (req, res, next) => {
  try {
    const nameVi = text(req.body.name_vi, 80);
    const nameEn = text(req.body.name_en, 80) || nameVi;
    if (!nameVi) throw new ApiError('INVALID_NAME', 400);
    const slug = uniqueCategorySlug(slugify(req.body.slug || nameVi));
    const info = db.prepare('INSERT INTO categories (slug, name_vi, name_en) VALUES (?, ?, ?)').run(slug, nameVi, nameEn);
    res.status(201).json({ category: db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid) });
  } catch (error) {
    next(error);
  }
});

function uniqueCategorySlug(base) {
  let slug = base;
  let n = 2;
  while (db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug)) slug = `${base}-${n++}`;
  return slug;
}

router.patch('/categories/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!category) throw new ApiError('CATEGORY_NOT_FOUND', 404);
    const nameVi = req.body.name_vi !== undefined ? text(req.body.name_vi, 80) : category.name_vi;
    const nameEn = req.body.name_en !== undefined ? text(req.body.name_en, 80) : category.name_en;
    if (!nameVi) throw new ApiError('INVALID_NAME', 400);
    db.prepare('UPDATE categories SET name_vi = ?, name_en = ? WHERE id = ?').run(nameVi, nameEn || nameVi, id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/categories/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT id FROM categories WHERE id = ?').get(id)) throw new ApiError('CATEGORY_NOT_FOUND', 404);
    const count = db.prepare('SELECT COUNT(*) AS c FROM books WHERE category_id = ?').get(id).c;
    if (count) throw new ApiError('CATEGORY_IN_USE', 409, { books: count });
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = { router };
