const fs = require('fs/promises');
const path = require('path');
const { pool, query, toMysqlDate, toIsoString } = require('./mysql');

const SEED_FILE = path.join(__dirname, '..', 'data', 'knowledge.json');
const VALID_SECTIONS = new Set(['player', 'gm']);
const AVAILABILITY_AXES = ['infected', 'work'];
const VALID_AVAILABILITY_OPS = new Set(['all', 'in', 'not_in']);

function sanitizeString(value, defaultValue = '') {
  if (typeof value !== 'string') return defaultValue;
  return value.trim();
}

function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return Array.from(new Set(tags.map((tag) => sanitizeString(tag)).filter(Boolean)));
}

function sanitizeDisplayTags(tags) {
  return sanitizeTags(tags);
}

function sanitizeSection(section) {
  const value = sanitizeString(section);
  return VALID_SECTIONS.has(value) ? value : '';
}

function escapeLike(input) {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function parseRawTagsValue(value) {
  if (Array.isArray(value)) {
    return sanitizeTags(value);
  }

  if (value == null) return [];

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? sanitizeTags(parsed) : [];
    } catch {
      return [];
    }
  }

  if (typeof value === 'object') {
    return [];
  }

  return [];
}

function normalizeAvailabilityOp(op) {
  const value = sanitizeString(op).toLowerCase();
  return VALID_AVAILABILITY_OPS.has(value) ? value : '';
}

function createAllRule() {
  return { op: 'all', values: [] };
}

function normalizeAvailabilityValue(axis, value) {
  void axis;
  return sanitizeString(value).toLowerCase();
}

function sanitizeAvailabilityValues(axis, values) {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((value) => normalizeAvailabilityValue(axis, value))
        .filter(Boolean),
    ),
  );
}

function cloneRule(rule, axis) {
  if (!rule || typeof rule !== 'object') return createAllRule();
  const op = normalizeAvailabilityOp(rule.op) || 'all';
  const values = op === 'all' ? [] : sanitizeAvailabilityValues(axis, rule.values);
  if ((op === 'in' || op === 'not_in') && values.length === 0) {
    return createAllRule();
  }
  return { op, values };
}

function sanitizeAvailabilityRule(rule, fallbackRule, axis) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    return cloneRule(fallbackRule, axis);
  }

  const fallbackOp = normalizeAvailabilityOp(fallbackRule && fallbackRule.op) || 'all';
  const parsedOp = normalizeAvailabilityOp(rule.op);
  const op = parsedOp || fallbackOp;

  if (op === 'all') {
    return createAllRule();
  }

  const values = sanitizeAvailabilityValues(axis, rule.values);
  if (!values.length) {
    return createAllRule();
  }

  return { op, values };
}

function sanitizeAvailability(availability) {
  let source = null;

  if (availability && typeof availability === 'object' && !Array.isArray(availability)) {
    source = availability;
  } else if (typeof availability === 'string') {
    try {
      const parsed = JSON.parse(availability);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        source = parsed;
      }
    } catch {
      source = null;
    }
  }

  const result = {};

  AVAILABILITY_AXES.forEach((axis) => {
    const rule = source ? source[axis] : null;
    result[axis] = sanitizeAvailabilityRule(rule, createAllRule(), axis);
  });

  return result;
}

function validateAvailabilityInput(value) {
  const errors = [];

  if (value == null) {
    return { errors, data: sanitizeAvailability(null) };
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return {
      errors: ['availability must be an object'],
      data: sanitizeAvailability(null),
    };
  }

  AVAILABILITY_AXES.forEach((axis) => {
    if (!Object.prototype.hasOwnProperty.call(value, axis)) return;

    const rule = value[axis];
    if (rule == null) return;

    if (typeof rule !== 'object' || Array.isArray(rule)) {
      errors.push(`availability.${axis} must be an object`);
      return;
    }

    if (Object.prototype.hasOwnProperty.call(rule, 'op')) {
      const op = normalizeAvailabilityOp(rule.op);
      if (!op) {
        errors.push(`availability.${axis}.op must be one of: all, in, not_in`);
      }
    }

    if (Object.prototype.hasOwnProperty.call(rule, 'values') && !Array.isArray(rule.values)) {
      errors.push(`availability.${axis}.values must be an array of strings`);
    }
  });

  return { errors, data: sanitizeAvailability(value) };
}

function parseAvailabilityValue(value) {
  return sanitizeAvailability(value);
}

function mapKnowledgeRow(row) {
  if (!row || typeof row !== 'object') return null;

  const rawTags = parseRawTagsValue(row.tags);

  return {
    id: String(row.id),
    section: sanitizeSection(row.section),
    title: sanitizeString(row.title),
    available: sanitizeString(row.available),
    description: sanitizeString(row.description),
    tags: sanitizeDisplayTags(rawTags),
    availability: parseAvailabilityValue(row.availability),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function normalizeKnowledgeId(id) {
  const value = String(id || '').trim();
  if (!/^[1-9]\d*$/.test(value)) return null;
  return Number.parseInt(value, 10);
}

function buildWhereClause({ section = '', q = '', tags = [] } = {}) {
  const where = [];
  const params = [];

  const cleanSection = sanitizeSection(section);
  const cleanQuery = sanitizeString(q);
  const cleanTags = sanitizeTags(tags);

  if (cleanSection) {
    where.push('section = ?');
    params.push(cleanSection);
  }

  if (cleanTags.length) {
    cleanTags.forEach((tag) => {
      where.push('JSON_CONTAINS(tags, JSON_ARRAY(?))');
      params.push(tag);
    });
  }

  if (cleanQuery) {
    const like = `%${escapeLike(cleanQuery)}%`;
    where.push(
      `(
        title LIKE ? ESCAPE '\\\\'
        OR available LIKE ? ESCAPE '\\\\'
        OR description LIKE ? ESCAPE '\\\\'
        OR CAST(tags AS CHAR) LIKE ? ESCAPE '\\\\'
        OR CAST(availability AS CHAR) LIKE ? ESCAPE '\\\\'
      )`,
    );
    params.push(like, like, like, like, like);
  }

  if (!where.length) return { whereSql: '', params };
  return { whereSql: `WHERE ${where.join(' AND ')}`, params };
}

async function loadSeedItems() {
  const raw = await fs.readFile(SEED_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  const now = new Date();
  const items = [];

  ['player', 'gm'].forEach((section) => {
    const sectionItems = Array.isArray(parsed[section]) ? parsed[section] : [];
    sectionItems.forEach((item) => {
      const sourceTags = sanitizeTags(item.tags);
      items.push({
        section,
        title: sanitizeString(item.title),
        available: sanitizeString(item.available),
        description: sanitizeString(item.description),
        tags: sanitizeDisplayTags(sourceTags),
        availability: sanitizeAvailability(item.availability),
        createdAt: now,
        updatedAt: now,
      });
    });
  });

  return items;
}

async function insertKnowledgeItems(items, { clearExisting = false } = {}) {
  const conn = await pool().getConnection();

  try {
    await conn.beginTransaction();

    if (clearExisting) {
      await conn.execute('DELETE FROM knowledge_items');
    }

    for (const item of items) {
      await conn.execute(
        `INSERT INTO knowledge_items (section, title, available, description, tags, availability, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sanitizeSection(item.section),
          sanitizeString(item.title),
          sanitizeString(item.available),
          sanitizeString(item.description),
          JSON.stringify(sanitizeDisplayTags(item.tags)),
          JSON.stringify(sanitizeAvailability(item.availability)),
          toMysqlDate(item.createdAt) || toMysqlDate(),
          toMysqlDate(item.updatedAt) || toMysqlDate(),
        ],
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

async function seedKnowledgeCollectionIfEmpty() {
  const rows = await query('SELECT COUNT(*) AS total FROM knowledge_items');
  const count = Number(rows[0] && rows[0].total ? rows[0].total : 0);
  if (count > 0) return { seeded: false, count };

  const seedItems = await loadSeedItems();
  if (!seedItems.length) return { seeded: false, count: 0 };

  await insertKnowledgeItems(seedItems, { clearExisting: false });
  return { seeded: true, count: seedItems.length };
}

async function reseedKnowledgeCollection() {
  const seedItems = await loadSeedItems();

  await insertKnowledgeItems(seedItems, { clearExisting: true });
  return { seeded: seedItems.length > 0, count: seedItems.length };
}

async function initKnowledgeCollection() {
  return seedKnowledgeCollectionIfEmpty();
}

function validateKnowledgePayload(payload, { partial = false } = {}) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const errors = [];
  const data = {};
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(source, key);

  if (!partial || hasOwn('section')) {
    const section = sanitizeSection(source.section);
    if (!section) errors.push('section must be either "player" or "gm"');
    else data.section = section;
  }

  if (!partial || hasOwn('title')) {
    const title = sanitizeString(source.title);
    if (!title) errors.push('title is required');
    else data.title = title;
  }

  if (!partial || hasOwn('available')) {
    data.available = sanitizeString(source.available);
  }

  if (!partial || hasOwn('description')) {
    data.description = sanitizeString(source.description);
  }

  if (!partial || hasOwn('tags')) {
    if (source.tags != null && !Array.isArray(source.tags)) {
      errors.push('tags must be an array of strings');
    } else {
      data.tags = sanitizeDisplayTags(source.tags);
    }
  }

  if (!partial || hasOwn('availability')) {
    const { errors: availabilityErrors, data: normalizedAvailability } = validateAvailabilityInput(source.availability);
    errors.push(...availabilityErrors);
    data.availability = sanitizeAvailability(normalizedAvailability);
  }

  if (!partial && !Object.prototype.hasOwnProperty.call(data, 'availability')) {
    data.availability = sanitizeAvailability(null);
  }

  if (partial && Object.keys(data).length === 0) {
    errors.push('at least one field is required for update');
  }

  return { errors, data };
}

function isValidKnowledgeId(id) {
  return normalizeKnowledgeId(id) != null;
}

async function listKnowledgeItems({ section = '', q = '', tags = [], limit = 200, offset = 0 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 500));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const { whereSql, params } = buildWhereClause({ section, q, tags });

  const rows = await query(
    `SELECT id, section, title, available, description, tags, availability, created_at, updated_at
     FROM knowledge_items
     ${whereSql}
     ORDER BY section ASC, title ASC, id ASC
     LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    params,
  );

  return rows.map(mapKnowledgeRow).filter(Boolean);
}

async function countKnowledgeItems(filters = {}) {
  const { whereSql, params } = buildWhereClause(filters);
  const rows = await query(
    `SELECT COUNT(*) AS total
     FROM knowledge_items
     ${whereSql}`,
    params,
  );

  return Number(rows[0] && rows[0].total ? rows[0].total : 0);
}

function groupKnowledgeItems(items) {
  const grouped = { player: [], gm: [] };
  items.forEach((item) => {
    if (!item || !VALID_SECTIONS.has(item.section)) return;
    grouped[item.section].push(item);
  });
  return grouped;
}

async function getKnowledgeById(id) {
  const knowledgeId = normalizeKnowledgeId(id);
  if (!knowledgeId) return null;

  const rows = await query(
    `SELECT id, section, title, available, description, tags, availability, created_at, updated_at
     FROM knowledge_items
     WHERE id = ?
     LIMIT 1`,
    [knowledgeId],
  );

  return mapKnowledgeRow(rows[0] || null);
}

async function createKnowledgeItem(payload) {
  const now = toMysqlDate();
  const tags = sanitizeDisplayTags(payload.tags);
  const availability = sanitizeAvailability(payload.availability);

  const result = await query(
    `INSERT INTO knowledge_items (section, title, available, description, tags, availability, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.section,
      payload.title,
      payload.available || '',
      payload.description || '',
      JSON.stringify(tags),
      JSON.stringify(availability),
      now,
      now,
    ],
  );

  return getKnowledgeById(String(result.insertId));
}

async function replaceKnowledgeItemById(id, payload) {
  const knowledgeId = normalizeKnowledgeId(id);
  if (!knowledgeId) return null;

  const existing = await getKnowledgeById(String(knowledgeId));
  if (!existing) return null;

  const now = toMysqlDate();
  const createdAt = toMysqlDate(existing.createdAt) || now;
  const tags = sanitizeDisplayTags(payload.tags);
  const availability = sanitizeAvailability(payload.availability);

  await query(
    `UPDATE knowledge_items
     SET section = ?, title = ?, available = ?, description = ?, tags = ?, availability = ?, created_at = ?, updated_at = ?
     WHERE id = ?`,
    [
      payload.section,
      payload.title,
      payload.available || '',
      payload.description || '',
      JSON.stringify(tags),
      JSON.stringify(availability),
      createdAt,
      now,
      knowledgeId,
    ],
  );

  return getKnowledgeById(String(knowledgeId));
}

async function updateKnowledgeItemById(id, payload) {
  const knowledgeId = normalizeKnowledgeId(id);
  if (!knowledgeId) return null;

  const updates = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(payload, 'section')) {
    updates.push('section = ?');
    params.push(payload.section);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'title')) {
    updates.push('title = ?');
    params.push(payload.title);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'available')) {
    updates.push('available = ?');
    params.push(payload.available || '');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
    updates.push('description = ?');
    params.push(payload.description || '');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'tags')) {
    updates.push('tags = ?');
    params.push(JSON.stringify(sanitizeDisplayTags(payload.tags)));
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'availability')) {
    updates.push('availability = ?');
    params.push(JSON.stringify(sanitizeAvailability(payload.availability)));
  }

  if (!updates.length) return null;

  updates.push('updated_at = ?');
  params.push(toMysqlDate());
  params.push(knowledgeId);

  const result = await query(
    `UPDATE knowledge_items
     SET ${updates.join(', ')}
     WHERE id = ?`,
    params,
  );

  if (!result || result.affectedRows === 0) return null;
  return getKnowledgeById(String(knowledgeId));
}

async function deleteKnowledgeItemById(id) {
  const knowledgeId = normalizeKnowledgeId(id);
  if (!knowledgeId) return false;

  const result = await query('DELETE FROM knowledge_items WHERE id = ?', [knowledgeId]);
  return !!(result && result.affectedRows > 0);
}

module.exports = {
  initKnowledgeCollection,
  reseedKnowledgeCollection,
  validateKnowledgePayload,
  isValidKnowledgeId,
  listKnowledgeItems,
  countKnowledgeItems,
  groupKnowledgeItems,
  getKnowledgeById,
  createKnowledgeItem,
  replaceKnowledgeItemById,
  updateKnowledgeItemById,
  deleteKnowledgeItemById,
};
