const { pool, query, toMysqlDate, toIsoString } = require('./mysql');

function sanitizeString(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.trim();
}

function mapUserRow(row) {
  if (!row || typeof row !== 'object') return null;

  return {
    id: String(row.id),
    username: sanitizeString(row.username),
    password: sanitizeString(row.password),
    token: row.token == null ? null : String(row.token),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

async function readUsers() {
  const rows = await query(
    `SELECT id, username, password, token, created_at, updated_at
     FROM users
     ORDER BY created_at ASC, id ASC`,
  );

  return rows.map(mapUserRow).filter(Boolean);
}

async function saveUsers(users) {
  const list = Array.isArray(users) ? users : [];
  const conn = await pool().getConnection();

  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM users');

    for (const user of list) {
      const id = sanitizeString(user && user.id);
      const username = sanitizeString(user && user.username);
      const password = sanitizeString(user && user.password);

      if (!id || !username || !password) {
        throw new Error('user.id, user.username and user.password are required');
      }

      const createdAt = toMysqlDate(user.createdAt) || toMysqlDate();
      const updatedAt = toMysqlDate(user.updatedAt) || toMysqlDate();
      const token = user.token == null ? null : sanitizeString(user.token);

      await conn.execute(
        `INSERT INTO users (id, username, password, token, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, username, password, token || null, createdAt, updatedAt],
      );
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function findUserByUsername(username) {
  const value = sanitizeString(username);
  if (!value) return null;

  const rows = await query(
    `SELECT id, username, password, token, created_at, updated_at
     FROM users
     WHERE username = ?
     LIMIT 1`,
    [value],
  );

  return mapUserRow(rows[0] || null);
}

async function findUserById(id) {
  const value = sanitizeString(id);
  if (!value) return null;

  const rows = await query(
    `SELECT id, username, password, token, created_at, updated_at
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [value],
  );

  return mapUserRow(rows[0] || null);
}

async function findUserByToken(token) {
  const value = sanitizeString(token);
  if (!value) return null;

  const rows = await query(
    `SELECT id, username, password, token, created_at, updated_at
     FROM users
     WHERE token = ?
     LIMIT 1`,
    [value],
  );

  return mapUserRow(rows[0] || null);
}

async function createUser(user) {
  const id = sanitizeString(user && user.id);
  const username = sanitizeString(user && user.username);
  const password = sanitizeString(user && user.password);

  if (!id || !username || !password) {
    throw new Error('user.id, user.username and user.password are required');
  }

  const now = toMysqlDate();
  const createdAt = toMysqlDate(user.createdAt) || now;
  const token = user.token == null ? null : sanitizeString(user.token);

  await query(
    `INSERT INTO users (id, username, password, token, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, username, password, token || null, createdAt, now],
  );

  return findUserById(id);
}

async function updateUserToken(id, token) {
  const userId = sanitizeString(id);
  if (!userId) return null;

  const now = toMysqlDate();
  const tokenValue = token == null ? null : sanitizeString(token);

  const result = await query(
    `UPDATE users
     SET token = ?, updated_at = ?
     WHERE id = ?`,
    [tokenValue || null, now, userId],
  );

  if (!result || result.affectedRows === 0) return null;
  return findUserById(userId);
}

module.exports = {
  readUsers,
  saveUsers,
  findUserByUsername,
  findUserById,
  findUserByToken,
  createUser,
  updateUserToken,
};
