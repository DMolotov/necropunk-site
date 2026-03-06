const { readUsers } = require('../lib/users');

async function authMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' });

    const token = auth.slice(7);
    const users = await readUsers();
    const user = users.find((candidate) => candidate.token === token);
    if (!user) return res.status(401).json({ error: 'invalid token' });

    req.user = { id: user.id, username: user.username };
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = authMiddleware;
