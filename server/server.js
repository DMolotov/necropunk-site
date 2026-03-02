require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const statusRouter = require('./routes/status');
const authRouter = require('./routes/auth');
const { findUserByUsername, createUser, readUsers, saveUsers } = require('./lib/users');
const crypto = require('crypto');
const mongo = require('./lib/mongo');

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function hashPassword(password, salt) { salt = salt || crypto.randomBytes(16).toString('hex'); const derived = crypto.scryptSync(password, salt, 64).toString('hex'); return `${salt}:${derived}`; }
function verifyPassword(password, stored) { if (!stored) return false; const [salt, hash] = stored.split(':'); if (!salt || !hash) return false; const attempt = crypto.scryptSync(password, salt, 64).toString('hex'); return crypto.timingSafeEqual(Buffer.from(attempt,'hex'), Buffer.from(hash,'hex')); }
function genToken() { return crypto.randomBytes(32).toString('hex'); }

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '..', 'client', 'pages')));
app.use(express.json({ limit: '1mb' }));

// If `statusRouter` is a simple handler function, mount it as GET handler.
if (typeof statusRouter === 'function') {
  app.get('/api/status', statusRouter);
} else {
  app.use('/api/status', statusRouter);
}

// auth routes
app.use('/api/auth', authRouter);

// QUICK fallback endpoints (ensure auth available even if router mounting fails)
app.post('/api/auth/register', (req, res, next) => {
  try {
    const { username, password, confirmPassword } = req.body || {};
    if (!username || !password || !confirmPassword) return res.status(400).json({ error: 'username, password and confirmPassword required' });
    if (password !== confirmPassword) return res.status(400).json({ error: 'password and confirmation do not match' });
    if (findUserByUsername(username)) return res.status(409).json({ error: 'username already taken' });
    const id = genId(); const passwordHash = hashPassword(password); const token = genToken();
    createUser({ id, username, password: passwordHash, token, createdAt: new Date().toISOString() });
    return res.json({ user: { id, username }, token });
  } catch (e) { next(e); }
});

app.post('/api/auth/login', (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const user = findUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    if (!verifyPassword(password, user.password)) return res.status(401).json({ error: 'invalid credentials' });
    const token = genToken();
    const users = readUsers(); const idx = users.findIndex(u => u.id === user.id); if (idx >= 0) { users[idx].token = token; saveUsers(users); }
    return res.json({ user: { id: user.id, username: user.username }, token });
  } catch (e) { next(e); }
});

// Простая централизованная обработка ошибок
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

(async () => {
  try {
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DBNAME;
    if (uri) {
      await mongo.connect(uri, dbName);
      console.log('MongoDB connected');
    } else {
      console.log('MONGODB_URI not set; starting without DB');
    }

    const server = app.listen(port, () => {
      console.log(`Сервер запущен: http://localhost:${port}`);
    });

    process.on('SIGINT', () => {
      server.close(() => {
        console.log('Сервер корректно завершил работу');
        // close mongo if present
        try { if (mongo && mongo.client) { const c = mongo.client(); if (c && c.close) c.close(); } } catch (e) {}
        process.exit(0);
      });
    });
  } catch (e) {
    console.error('Startup error', e);
    process.exit(1);
  }
})();
