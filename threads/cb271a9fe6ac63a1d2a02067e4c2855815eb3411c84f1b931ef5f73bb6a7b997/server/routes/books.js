const express = require('express');
const { db } = require('../db');
const { ApiError, SETTINGS, nowIso, sweep } = require('../lib/library');
const { BOOK_FIELDS, bookByKey, listBooks } = require('../lib/queries');

const router = express.Router();

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

router.get('/stats', (req, res) => {
  const one = (sql) => db.prepare(sql).get().c;
  res.json({
    stats: {
      books: one('SELECT COUNT(*) AS c FROM books'),
      copies: db.prepare('SELECT COALESCE(SUM(total_copies), 0) AS c FROM books').get().c,
      available: db.prepare('SELECT COALESCE(SUM(available_copies), 0) AS c FROM books').get().c,
      members: one("SELECT COUNT(*) AS c FROM users WHERE role = 'member'"),
      categories: one('SELECT COUNT(*) AS c FROM categories'),
      active_loans: one("SELECT COUNT(*) AS c FROM loans WHERE status = 'active'"),
      reviews: one('SELECT COUNT(*) AS c FROM reviews'),
    },
    settings: SETTINGS,
  });
});

router.get('/books', (req, res) => {
  sweep(db);
  res.json(listBooks(db, req.query));
});

router.get('/books/:key', (req, res, next) => {
  try {
    sweep(db);
    const book = bookByKey(db, req.params.key);
    if (!book) throw new ApiError('BOOK_NOT_FOUND', 404);

    const reviews = db
      .prepare(
        `SELECT r.id, r.rating, r.comment, r.created_at, r.updated_at, r.user_id, u.name AS user_name
         FROM reviews r JOIN users u ON u.id = r.user_id
         WHERE r.book_id = ? ORDER BY r.created_at DESC LIMIT 50`
      )
      .all(book.id);

    const related = db
      .prepare(
        `SELECT ${BOOK_FIELDS} FROM books b LEFT JOIN categories c ON c.id = b.category_id
         WHERE b.category_id = ? AND b.id <> ? ORDER BY (b.available_copies > 0) DESC, b.featured DESC, RANDOM() LIMIT 4`
      )
      .all(book.category_id || -1, book.id);

    let myLoan = null;
    let myReservation = null;
    let isFavorite = false;
    if (req.user) {
      myLoan = db
        .prepare("SELECT id, due_at, borrowed_at FROM loans WHERE user_id = ? AND book_id = ? AND status = 'active'")
        .get(req.user.id, book.id) || null;
      myReservation = db
        .prepare(
          "SELECT id, status, expires_at FROM reservations WHERE user_id = ? AND book_id = ? AND status IN ('waiting', 'ready')"
        )
        .get(req.user.id, book.id) || null;
      isFavorite = Boolean(
        db.prepare('SELECT 1 AS x FROM favorites WHERE user_id = ? AND book_id = ?').get(req.user.id, book.id)
      );
    }

    res.json({
      book,
      reviews,
      related,
      viewer: { loan: myLoan, reservation: myReservation, is_favorite: isFavorite },
      settings: SETTINGS,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/books/:id/reviews', (req, res, next) => {
  try {
    if (!req.user) throw new ApiError('UNAUTHORIZED', 401);
    if (req.user.status !== 'active') throw new ApiError('ACCOUNT_SUSPENDED', 403);
    const bookId = Number(req.params.id);
    const book = db.prepare('SELECT id FROM books WHERE id = ?').get(bookId);
    if (!book) throw new ApiError('BOOK_NOT_FOUND', 404);
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ApiError('INVALID_RATING', 400);
    const comment = String(req.body.comment || '').trim().slice(0, 1000) || null;
    const now = nowIso();
    db.prepare(
      `INSERT INTO reviews (user_id, book_id, rating, comment, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, book_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, updated_at = excluded.updated_at`
    ).run(req.user.id, bookId, rating, comment, now, now);
    const review = db
      .prepare(
        `SELECT r.id, r.rating, r.comment, r.created_at, r.updated_at, r.user_id, u.name AS user_name
         FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.book_id = ? AND r.user_id = ?`
      )
      .get(bookId, req.user.id);
    res.status(201).json({ review });
  } catch (error) {
    next(error);
  }
});

router.delete('/reviews/:id', (req, res, next) => {
  try {
    if (!req.user) throw new ApiError('UNAUTHORIZED', 401);
    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(Number(req.params.id));
    if (!review) throw new ApiError('REVIEW_NOT_FOUND', 404);
    if (review.user_id !== req.user.id && req.user.role !== 'admin') throw new ApiError('FORBIDDEN', 403);
    db.prepare('DELETE FROM reviews WHERE id = ?').run(review.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/favorites', (req, res, next) => {
  try {
    if (!req.user) throw new ApiError('UNAUTHORIZED', 401);
    const items = db
      .prepare(
        `SELECT ${BOOK_FIELDS}, f.created_at AS saved_at FROM favorites f
         JOIN books b ON b.id = f.book_id LEFT JOIN categories c ON c.id = b.category_id
         WHERE f.user_id = ? ORDER BY f.created_at DESC`
      )
      .all(req.user.id);
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.post('/favorites/:bookId', (req, res, next) => {
  try {
    if (!req.user) throw new ApiError('UNAUTHORIZED', 401);
    const bookId = Number(req.params.bookId);
    if (!db.prepare('SELECT 1 AS x FROM books WHERE id = ?').get(bookId)) {
      throw new ApiError('BOOK_NOT_FOUND', 404);
    }
    db.prepare(
      'INSERT INTO favorites (user_id, book_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
    ).run(req.user.id, bookId, nowIso());
    res.status(201).json({ ok: true, is_favorite: true });
  } catch (error) {
    next(error);
  }
});

router.delete('/favorites/:bookId', (req, res, next) => {
  try {
    if (!req.user) throw new ApiError('UNAUTHORIZED', 401);
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND book_id = ?').run(
      req.user.id,
      Number(req.params.bookId)
    );
    res.json({ ok: true, is_favorite: false });
  } catch (error) {
    next(error);
  }
});

module.exports = { router };
