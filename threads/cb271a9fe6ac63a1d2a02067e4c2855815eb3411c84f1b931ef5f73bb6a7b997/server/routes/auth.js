const express = require('express');
const { db } = require('../db');
const { hashPassword, verifyPassword, setSession, clearSession } = require('../lib/auth');
const { ApiError, publicUser, nowIso } = require('../lib/library');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function requireAuth(req, res, next) {
  if (!req.user) return next(new ApiError('UNAUTHORIZED', 401));
  if (req.user.status !== 'active') return next(new ApiError('ACCOUNT_SUSPENDED', 403));
  next();
}

function sanitize(value, max = 200) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

router.post('/register', (req, res, next) => {
  try {
    const name = sanitize(req.body.name, 80);
    const email = sanitize(req.body.email, 160).toLowerCase();
    const password = String(req.body.password || '');
    if (name.length < 2) throw new ApiError('INVALID_NAME', 400);
    if (!EMAIL_RE.test(email)) throw new ApiError('INVALID_EMAIL', 400);
    if (password.length < 6) throw new ApiError('WEAK_PASSWORD', 400);
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (exists) throw new ApiError('EMAIL_TAKEN', 409);

    const info = db
      .prepare(
        `INSERT INTO users (name, email, password_hash, role, status, created_at)
         VALUES (?, ?, ?, 'member', 'active', ?)`
      )
      .run(name, email, hashPassword(password), nowIso());
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    setSession(res, user.id);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/login', (req, res, next) => {
  try {
    const email = sanitize(req.body.email, 160).toLowerCase();
    const password = String(req.body.password || '');
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new ApiError('INVALID_CREDENTIALS', 401);
    }
    if (user.status !== 'active') throw new ApiError('ACCOUNT_SUSPENDED', 403);
    setSession(res, user.id);
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.patch('/profile', requireAuth, (req, res, next) => {
  try {
    const name = sanitize(req.body.name, 80);
    if (name.length < 2) throw new ApiError('INVALID_NAME', 400);
    const phone = sanitize(req.body.phone, 30) || null;
    const address = sanitize(req.body.address, 200) || null;
    db.prepare('UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?').run(
      name,
      phone,
      address,
      req.user.id
    );
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/password', requireAuth, (req, res, next) => {
  try {
    const current = String(req.body.current || '');
    const next_ = String(req.body.next || '');
    if (!verifyPassword(current, req.user.password_hash)) throw new ApiError('WRONG_PASSWORD', 400);
    if (next_.length < 6) throw new ApiError('WEAK_PASSWORD', 400);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      hashPassword(next_),
      req.user.id
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = { router, requireAuth };
