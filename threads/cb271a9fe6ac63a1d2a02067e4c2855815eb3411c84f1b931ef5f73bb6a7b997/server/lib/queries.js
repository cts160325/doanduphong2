const { SETTINGS, loanOut, nowIso } = require('./library');

const BOOK_FIELDS = `
  b.id, b.slug, b.title, b.author, b.isbn, b.publisher, b.year, b.language, b.pages,
  b.description_vi, b.description_en, b.cover_url, b.cover_tone, b.total_copies, b.available_copies,
  b.shelf, b.featured, b.created_at,
  c.id AS category_id, c.slug AS category_slug, c.name_vi AS category_vi, c.name_en AS category_en,
  (SELECT ROUND(AVG(rating), 1) FROM reviews r WHERE r.book_id = b.id) AS rating_avg,
  (SELECT COUNT(*) FROM reviews r WHERE r.book_id = b.id) AS rating_count,
  (SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id) AS loan_count,
  (SELECT COUNT(*) FROM loans l WHERE l.book_id = b.id AND l.status = 'active') AS active_loans,
  (SELECT COUNT(*) FROM reservations rv WHERE rv.book_id = b.id AND rv.status IN ('waiting', 'ready')) AS queue_length
`;

const SORTS = {
  featured: 'b.featured DESC, b.created_at DESC',
  newest: 'b.created_at DESC',
  oldest: 'b.created_at ASC',
  title: 'b.title COLLATE NOCASE ASC',
  author: 'b.author COLLATE NOCASE ASC',
  rating: 'rating_avg IS NULL, rating_avg DESC, rating_count DESC',
  popular: 'loan_count DESC, b.title COLLATE NOCASE ASC',
};

function bookByKey(db, key) {
  const numeric = /^\d+$/.test(String(key));
  return db
    .prepare(
      `SELECT ${BOOK_FIELDS} FROM books b LEFT JOIN categories c ON c.id = b.category_id
       WHERE ${numeric ? 'b.id' : 'b.slug'} = ?`
    )
    .get(numeric ? Number(key) : String(key));
}

function listBooks(db, filters = {}) {
  const where = ['1 = 1'];
  const params = {};
  const q = String(filters.q || '').trim();
  if (q) {
    where.push('(b.title LIKE @q OR b.author LIKE @q OR b.isbn LIKE @q OR b.publisher LIKE @q)');
    params.q = `%${q}%`;
  }
  if (filters.category) {
    where.push('c.slug = @category');
    params.category = filters.category;
  }
  if (filters.language && filters.language !== 'all') {
    where.push('b.language = @language');
    params.language = filters.language;
  }
  if (filters.availability === 'available') where.push('b.available_copies > 0');
  if (filters.availability === 'unavailable') where.push('b.available_copies = 0');
  if (filters.featured === 'true') where.push('b.featured = 1');
  if (filters.exclude) {
    where.push('b.id <> @exclude');
    params.exclude = Number(filters.exclude);
  }

  const limit = Math.min(60, Math.max(1, Number(filters.limit) || 12));
  const page = Math.max(1, Number(filters.page) || 1);
  const offset = (page - 1) * limit;
  const order = SORTS[filters.sort] || SORTS.featured;
  const whereSql = where.join(' AND ');

  const total = db
    .prepare(
      `SELECT COUNT(*) AS c FROM books b LEFT JOIN categories c ON c.id = b.category_id WHERE ${whereSql}`
    )
    .get(params).c;

  const items = db
    .prepare(
      `SELECT ${BOOK_FIELDS} FROM books b LEFT JOIN categories c ON c.id = b.category_id
       WHERE ${whereSql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`
    )
    .all(params);

  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit };
}

const LOAN_FIELDS = `
  l.id, l.user_id, l.book_id, l.borrowed_at, l.due_at, l.returned_at, l.renewed_count,
  l.fine_amount, l.fine_status, l.status, l.settled_at,
  b.slug AS book_slug, b.title AS book_title, b.author AS book_author,
  b.cover_tone AS book_cover_tone, b.cover_url AS book_cover_url, b.language AS book_language,
  u.name AS user_name, u.email AS user_email, u.id AS member_id
`;

function loanWhere(filters = {}) {
  const where = ['1 = 1'];
  const params = {};
  if (filters.userId) {
    where.push('l.user_id = @userId');
    params.userId = Number(filters.userId);
  }
  if (filters.status === 'active') where.push("l.status = 'active'");
  if (filters.status === 'overdue') where.push("l.status = 'active' AND l.due_at < @now");
  if (filters.status === 'returned') where.push("l.status = 'returned'");
  if (filters.status === 'unpaid_fines') where.push("l.fine_status = 'unpaid'");
  if (filters.q) {
    where.push('(b.title LIKE @q OR b.author LIKE @q OR u.name LIKE @q OR u.email LIKE @q)');
    params.q = `%${filters.q}%`;
  }
  params.now = nowIso();
  return { whereSql: where.join(' AND '), params };
}

function listLoans(db, filters = {}) {
  const { whereSql, params } = loanWhere(filters);
  const limit = Math.min(200, Math.max(1, Number(filters.limit) || 50));
  const page = Math.max(1, Number(filters.page) || 1);
  const offset = (page - 1) * limit;
  const order =
    filters.status === 'returned' ? 'l.returned_at DESC' : 'l.due_at ASC, l.id DESC';
  const total = db
    .prepare(
      `SELECT COUNT(*) AS c FROM loans l JOIN books b ON b.id = l.book_id JOIN users u ON u.id = l.user_id
       WHERE ${whereSql}`
    )
    .get(params).c;
  const rows = db
    .prepare(
      `SELECT ${LOAN_FIELDS} FROM loans l JOIN books b ON b.id = l.book_id JOIN users u ON u.id = l.user_id
       WHERE ${whereSql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`
    )
    .all(params);
  return {
    items: rows.map((row) => loanOut(row)),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    settings: SETTINGS,
  };
}

function loanById(db, id) {
  const row = db
    .prepare(
      `SELECT ${LOAN_FIELDS} FROM loans l JOIN books b ON b.id = l.book_id JOIN users u ON u.id = l.user_id
       WHERE l.id = ?`
    )
    .get(Number(id));
  return loanOut(row);
}

const RESERVATION_FIELDS = `
  rv.id, rv.user_id, rv.book_id, rv.created_at, rv.status, rv.ready_at, rv.expires_at,
  b.slug AS book_slug, b.title AS book_title, b.author AS book_author,
  b.cover_tone AS book_cover_tone, b.cover_url AS book_cover_url, b.available_copies, b.total_copies,
  u.name AS user_name, u.email AS user_email,
  (SELECT COUNT(*) FROM reservations r2
     WHERE r2.book_id = rv.book_id AND r2.status = 'waiting' AND (r2.created_at < rv.created_at OR (r2.created_at = rv.created_at AND r2.id < rv.id))
  ) + 1 AS queue_position
`;

function listReservations(db, filters = {}) {
  const where = ['1 = 1'];
  const params = {};
  if (filters.userId) {
    where.push('rv.user_id = @userId');
    params.userId = Number(filters.userId);
  }
  if (filters.status && filters.status !== 'all') {
    where.push('rv.status = @status');
    params.status = filters.status;
  }
  if (filters.activeOnly) where.push("rv.status IN ('waiting', 'ready')");
  if (filters.q) {
    where.push('(b.title LIKE @q OR u.name LIKE @q OR u.email LIKE @q)');
    params.q = `%${filters.q}%`;
  }
  const whereSql = where.join(' AND ');
  const limit = Math.min(200, Math.max(1, Number(filters.limit) || 50));
  const page = Math.max(1, Number(filters.page) || 1);
  const offset = (page - 1) * limit;
  const total = db
    .prepare(
      `SELECT COUNT(*) AS c FROM reservations rv JOIN books b ON b.id = rv.book_id JOIN users u ON u.id = rv.user_id
       WHERE ${whereSql}`
    )
    .get(params).c;
  const items = db
    .prepare(
      `SELECT ${RESERVATION_FIELDS} FROM reservations rv JOIN books b ON b.id = rv.book_id JOIN users u ON u.id = rv.user_id
       WHERE ${whereSql}
       ORDER BY CASE rv.status WHEN 'ready' THEN 0 WHEN 'waiting' THEN 1 ELSE 2 END, rv.created_at ASC
       LIMIT ${limit} OFFSET ${offset}`
    )
    .all(params);
  return { items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

module.exports = {
  BOOK_FIELDS,
  bookByKey,
  listBooks,
  LOAN_FIELDS,
  listLoans,
  loanById,
  listReservations,
  RESERVATION_FIELDS,
};
