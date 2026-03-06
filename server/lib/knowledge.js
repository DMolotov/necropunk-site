const fs = require('fs/promises');
const path = require('path');
const { ObjectId } = require('mongodb');
const { getDb } = require('./mongo');

const COLLECTION = 'knowledge';
const SEED_FILE = path.join(__dirname, '..', 'data', 'knowledge.json');
const VALID_SECTIONS = new Set(['player', 'gm']);

function getCollection() {
  return getDb().collection(COLLECTION);
}

function sanitizeString(value, defaultValue = '') {
  if (typeof value !== 'string') return defaultValue;
  return value.trim();
}

function sanitizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => sanitizeString(tag))
    .filter(Boolean);
}

function sanitizeSection(section) {
  const value = sanitizeString(section);
  return VALID_SECTIONS.has(value) ? value : '';
}

function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mapKnowledgeDocument(doc) {
  if (!doc || typeof doc !== 'object') return null;
  return {
    id: String(doc._id),
    section: sanitizeSection(doc.section),
    title: sanitizeString(doc.title),
    available: sanitizeString(doc.available),
    description: sanitizeString(doc.description),
    tags: sanitizeTags(doc.tags),
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

function buildFilter({ section = '', q = '', tags = [] } = {}) {
  const filter = {};
  const cleanSection = sanitizeSection(section);
  const cleanQuery = sanitizeString(q);
  const cleanTags = sanitizeTags(tags);

  if (cleanSection) filter.section = cleanSection;
  if (cleanTags.length) filter.tags = { $all: cleanTags };
  if (cleanQuery) {
    const regex = new RegExp(escapeRegex(cleanQuery), 'i');
    filter.$or = [
      { title: regex },
      { available: regex },
      { description: regex },
      { tags: regex },
    ];
  }

  return filter;
}

async function ensureKnowledgeIndexes() {
  const col = getCollection();
  await col.createIndex({ section: 1, title: 1 });
  await col.createIndex({ tags: 1 });
  await col.createIndex({ updatedAt: -1 });
}

async function loadSeedItems() {
  const raw = await fs.readFile(SEED_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  const now = new Date().toISOString();
  const items = [];

  ['player', 'gm'].forEach((section) => {
    const sectionItems = Array.isArray(parsed[section]) ? parsed[section] : [];
    sectionItems.forEach((item) => {
      items.push({
        section,
        title: sanitizeString(item.title),
        available: sanitizeString(item.available),
        description: sanitizeString(item.description),
        tags: sanitizeTags(item.tags),
        createdAt: now,
        updatedAt: now,
      });
    });
  });

  return items;
}

async function seedKnowledgeCollectionIfEmpty() {
  const col = getCollection();
  const count = await col.estimatedDocumentCount();
  if (count > 0) return { seeded: false, count };

  const seedItems = await loadSeedItems();
  if (!seedItems.length) return { seeded: false, count: 0 };

  const result = await col.insertMany(seedItems);
  return { seeded: true, count: result.insertedCount };
}

async function reseedKnowledgeCollection() {
  await ensureKnowledgeIndexes();
  const col = getCollection();
  const seedItems = await loadSeedItems();

  await col.deleteMany({});
  if (!seedItems.length) return { seeded: false, count: 0 };

  const result = await col.insertMany(seedItems);
  return { seeded: true, count: result.insertedCount };
}

async function initKnowledgeCollection() {
  await ensureKnowledgeIndexes();
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
      data.tags = sanitizeTags(source.tags);
    }
  }

  if (partial && Object.keys(data).length === 0) {
    errors.push('at least one field is required for update');
  }

  return { errors, data };
}

function isValidKnowledgeId(id) {
  return ObjectId.isValid(id);
}

async function listKnowledgeItems({ section = '', q = '', tags = [], limit = 200, offset = 0 } = {}) {
  const col = getCollection();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 500));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const filter = buildFilter({ section, q, tags });
  const docs = await col
    .find(filter)
    .sort({ section: 1, title: 1, _id: 1 })
    .skip(safeOffset)
    .limit(safeLimit)
    .toArray();

  return docs
    .map(mapKnowledgeDocument)
    .filter(Boolean);
}

async function countKnowledgeItems(filters = {}) {
  const col = getCollection();
  const filter = buildFilter(filters);
  return col.countDocuments(filter);
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
  if (!isValidKnowledgeId(id)) return null;
  const col = getCollection();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  return mapKnowledgeDocument(doc);
}

async function createKnowledgeItem(payload) {
  const col = getCollection();
  const now = new Date().toISOString();
  const doc = {
    section: payload.section,
    title: payload.title,
    available: payload.available || '',
    description: payload.description || '',
    tags: sanitizeTags(payload.tags),
    createdAt: now,
    updatedAt: now,
  };

  const result = await col.insertOne(doc);
  return getKnowledgeById(String(result.insertedId));
}

async function replaceKnowledgeItemById(id, payload) {
  if (!isValidKnowledgeId(id)) return null;

  const col = getCollection();
  const objectId = new ObjectId(id);
  const existing = await col.findOne({ _id: objectId });
  if (!existing) return null;

  const updatedDoc = {
    section: payload.section,
    title: payload.title,
    available: payload.available || '',
    description: payload.description || '',
    tags: sanitizeTags(payload.tags),
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await col.replaceOne({ _id: objectId }, updatedDoc);
  return getKnowledgeById(id);
}

async function updateKnowledgeItemById(id, payload) {
  if (!isValidKnowledgeId(id)) return null;

  const col = getCollection();
  const objectId = new ObjectId(id);
  const updates = { ...payload, updatedAt: new Date().toISOString() };
  if (Object.prototype.hasOwnProperty.call(updates, 'tags')) {
    updates.tags = sanitizeTags(updates.tags);
  }

  const result = await col.findOneAndUpdate(
    { _id: objectId },
    { $set: updates },
    { returnDocument: 'after' },
  );

  return mapKnowledgeDocument(result.value);
}

async function deleteKnowledgeItemById(id) {
  if (!isValidKnowledgeId(id)) return false;
  const col = getCollection();
  const result = await col.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
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
