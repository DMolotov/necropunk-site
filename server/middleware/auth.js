const { readUsers } = require('../lib/users');

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' });
  const token = auth.slice(7);
  const users = readUsers();
  const user = users.find(u => u.token === token);
  if (!user) return res.status(401).json({ error: 'invalid token' });
  req.user = { id: user.id, username: user.username };
  return next();
}

module.exports = authMiddleware;
