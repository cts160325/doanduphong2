const path = require('node:path');
const express = require('express');
const { db, isEmpty } = require('./db');
const { ensureSeed } = require('./seed');
const { readSession } = require('./lib/auth');
const { ApiError, sweep } = require('./lib/library');
const authRoutes = require('./routes/auth');
const booksRoutes = require('./routes/books');
const accountRoutes = require('./routes/account');
const adminRoutes = require('./routes/admin');

if (isEmpty()) ensureSeed(db);

const app = express();
const publicDir = path.join(__dirname, '..', 'public');

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

app.use((req, res, next) => {
  const session = readSession(req);
  req.user = session ? db.prepare('SELECT * FROM users WHERE id = ?').get(session.uid) || null : null;
  next();
});

let lastSweep = 0;
app.use('/api', (req, res, next) => {
  if (Date.now() - lastSweep > 15000) {
    lastSweep = Date.now();
    try {
      sweep(db);
    } catch (error) {
      console.error('sweep failed', error);
    }
  }
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    books: db.prepare('SELECT COUNT(*) AS c FROM books').get().c,
    members: db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
  });
});

app.use('/api/auth', authRoutes.router);
app.use('/api/account', accountRoutes.router);
app.use('/api/admin', adminRoutes.router);
app.use('/api', booksRoutes.router);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', path: req.path });
});

app.use(express.static(publicDir, { extensions: ['html'], maxAge: 0 }));

app.get('*', (req, res, next) => {
  if (req.method !== 'GET') return next();
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.code, ...err.meta });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'INVALID_JSON' });
  }
  console.error(err);
  return res.status(500).json({ error: 'SERVER_ERROR' });
});

const port = Number(process.env.PORT) || 4310;
const host = process.env.HOST || '127.0.0.1';

app.listen(port, host, () => {
  console.log(`Mộc Library running on http://${host}:${port}`);
  console.log('Demo accounts:');
  console.log('  admin@thuvien.vn / admin123   (quản trị viên)');
  console.log('  minhanh@example.com / member123 (độc giả)');
});
