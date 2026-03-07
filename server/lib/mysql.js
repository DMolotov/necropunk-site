const mysql = require('mysql2/promise');

let _pool = null;
const CREATE_DB_PERMISSION_ERRORS = new Set([
  'ER_DBACCESS_DENIED_ERROR',
  'ER_ACCESS_DENIED_ERROR',
]);

function parseIntValue(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function quoteIdentifier(identifier) {
  if (typeof identifier !== 'string' || !identifier.trim()) {
    throw new Error('MySQL identifier is required');
  }
  return `\`${identifier.replace(/`/g, '``')}\``;
}

function parseMysqlUrl(url) {
  if (!url) return {};

  const parsed = new URL(url);
  if (!parsed.protocol.startsWith('mysql')) {
    throw new Error('MYSQL_URL must start with mysql://');
  }

  return {
    host: parsed.hostname,
    port: parsed.port ? parseIntValue(parsed.port, 3306) : 3306,
    user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    database: parsed.pathname ? decodeURIComponent(parsed.pathname.replace(/^\//, '')) : undefined,
  };
}

function resolveConfig(overrides = {}) {
  const envUrl = process.env.MYSQL_URL || process.env.MYSQL_URI || '';
  const urlConfig = parseMysqlUrl(envUrl);

  return {
    host: overrides.host || urlConfig.host || process.env.MYSQL_HOST || '127.0.0.1',
    port: parseIntValue(overrides.port || urlConfig.port || process.env.MYSQL_PORT, 3306),
    user: overrides.user || urlConfig.user || process.env.MYSQL_USER || 'root',
    password: overrides.password ?? urlConfig.password ?? process.env.MYSQL_PASSWORD ?? '',
    database: overrides.database || urlConfig.database || process.env.MYSQL_DATABASE || 'necropunk',
    connectionLimit: parseIntValue(process.env.MYSQL_CONNECTION_LIMIT, 10),
  };
}

function createPoolConfig(config, { includeDatabase }) {
  return {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: includeDatabase ? config.database : undefined,
    waitForConnections: true,
    connectionLimit: config.connectionLimit,
    charset: 'utf8mb4',
    timezone: 'Z',
  };
}

function shouldAutoCreateDatabase() {
  const raw = String(process.env.MYSQL_AUTO_CREATE_DATABASE || 'true').trim().toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(raw);
}

async function ensureDatabaseExists(config) {
  const bootstrapPool = mysql.createPool(createPoolConfig(config, { includeDatabase: false }));
  try {
    await bootstrapPool.query(
      `CREATE DATABASE IF NOT EXISTS ${quoteIdentifier(config.database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await bootstrapPool.end();
  }
}

async function connect(overrides = {}) {
  if (_pool) return _pool;

  const config = resolveConfig(overrides);
  if (shouldAutoCreateDatabase()) {
    try {
      await ensureDatabaseExists(config);
    } catch (error) {
      if (!CREATE_DB_PERMISSION_ERRORS.has(error.code)) {
        throw error;
      }
    }
  }

  _pool = mysql.createPool(createPoolConfig(config, { includeDatabase: true }));
  await _pool.query('SELECT 1');
  return _pool;
}

function pool() {
  if (!_pool) {
    throw new Error('MySQL is not connected. Call connect() first.');
  }
  return _pool;
}

async function close() {
  if (!_pool) return;
  const p = _pool;
  _pool = null;
  await p.end();
}

async function query(sql, params = []) {
  const p = pool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

async function initSchema() {
  const p = pool();

  await p.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      username VARCHAR(191) NOT NULL,
      password VARCHAR(255) NOT NULL,
      token VARCHAR(128) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY uq_users_username (username),
      KEY idx_users_token (token)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS knowledge_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      section ENUM('player', 'gm') NOT NULL,
      title VARCHAR(255) NOT NULL,
      available TEXT NOT NULL,
      description TEXT NOT NULL,
      tags JSON NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY idx_knowledge_section_title (section, title),
      KEY idx_knowledge_updated_at (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function toMysqlDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 23).replace('T', ' ');
}

function toIsoString(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

module.exports = {
  connect,
  pool,
  query,
  close,
  initSchema,
  toMysqlDate,
  toIsoString,
};
