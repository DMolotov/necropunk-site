require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const statusRouter = require('./routes/status');
const authRouter = require('./routes/auth');
const { findUserByUsername, createUser, readUsers, saveUsers } = require('./lib/users');
const crypto = require('crypto');

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function hashPassword(password, salt) { salt = salt || crypto.randomBytes(16).toString('hex'); const derived = crypto.scryptSync(password, salt, 64).toString('hex'); return `${salt}:${derived}`; }
function verifyPassword(password, stored) { if (!stored) return false; const [salt, hash] = stored.split(':'); if (!salt || !hash) return false; const attempt = crypto.scryptSync(password, salt, 64).toString('hex'); return crypto.timingSafeEqual(Buffer.from(attempt,'hex'), Buffer.from(hash,'hex')); }
function genToken() { return crypto.randomBytes(32).toString('hex'); }

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
console.log('authRouter typeof =>', typeof authRouter);
console.log('authRouter keys =>', authRouter && Object.keys(authRouter));

const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.static('public'));
app.use(express.json({ limit: '1mb' }));

// If `statusRouter` is a simple handler function, mount it as GET handler.
if (typeof statusRouter === 'function') {
  app.get('/api/status', statusRouter);
} else {
  // fallback: try to mount as middleware/router
  app.use('/api/status', statusRouter);
}

// auth routes
app.use('/api/auth', authRouter);

// debug: list registered routes
function listRoutes() {
  const routes = [];
  app._router.stack.forEach(mw => {
    if (mw.route) {
      const methods = Object.keys(mw.route.methods).join(',');
      routes.push({ path: mw.route.path, methods });
    } else if (mw.name === 'router' && mw.handle && mw.handle.stack) {
      mw.handle.stack.forEach(r => {
        if (r.route) routes.push({ path: (mw.regexp && mw.regexp.source) + r.route.path, methods: Object.keys(r.route.methods).join(',') });
      });
    }
  });
  try {
    const fs = require('fs');
    const p = require('path').resolve(__dirname, 'data', 'routes.json');
    fs.mkdirSync(require('path').resolve(__dirname, 'data'), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(routes, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write routes.json', e && e.message);
  }
}
listRoutes();

// Простая централизованная обработка ошибок
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const server = app.listen(port, () => {
  console.log(`Сервер запущен: http://localhost:${port}`);
});

process.on('SIGINT', () => {
  server.close(() => {
    console.log('Сервер корректно завершил работу');
    process.exit(0);
  });
});