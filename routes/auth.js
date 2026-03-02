const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { findUserByUsername, createUser, saveUsers, readUsers } = require('../lib/users');

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const attempt = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(attempt, 'hex'), Buffer.from(hash, 'hex'));
}

function genToken() {
  return crypto.randomBytes(32).toString('hex');
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { username, password, confirmPassword } = req.body || {};
  if (!username || !password || !confirmPassword) {
    return res.status(400).json({ error: 'username, password and confirmPassword required' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'password and confirmation do not match' });
  }
  const existed = findUserByUsername(username);
  if (existed) return res.status(409).json({ error: 'username already taken' });

  const id = genId();
  const passwordHash = hashPassword(password);
  const token = genToken();
  const user = { id, username, password: passwordHash, token, createdAt: new Date().toISOString() };
  createUser(user);
  return res.json({ user: { id: user.id, username: user.username }, token });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const user = findUserByUsername(username);
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  const ok = verifyPassword(password, user.password);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  // rotate token
  const token = genToken();
  const users = readUsers();
  const idx = users.findIndex(u => u.id === user.id);
  if (idx >= 0) {
    users[idx].token = token;
    saveUsers(users);
  }
  return res.json({ user: { id: user.id, username: user.username }, token });
});

module.exports = router;
