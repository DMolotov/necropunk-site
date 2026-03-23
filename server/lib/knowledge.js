const fs = require('fs/promises');
const path = require('path');

const SEED_FILE = path.join(__dirname, '..', 'data', 'knowledge.json');
const VALID_SECTIONS = new Set(['player', 'gm']);
const AVAILABILITY_AXES = ['infected', 'work'];
const VALID_AVAILABILITY_OPS = new Set(['all', 'in', 'not_in']);

let loaded = false;
let loadedAt = null;
let itemsCache = [];
let byIdCache = new Map();

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

function toIsoString(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeKnowledgeId(id) {
  const value = String(id || '').trim();
  if (!/^[1-9]\d*$/.test(value)) return null;
  return Number.parseInt(value, 10);
}

function buildSearchIndex(item) {
  return [
    item.title,
    item.available,
    item.description,
    item.tags.join(' '),
    JSON.stringify(item.availability),
  ]
    .join(' ')
    .toLowerCase();
}

function toPublicItem(item) {
  return {
    id: item.id,
    section: item.section,
    title: item.title,
    available: item.available,
    description: item.description,
    tags: item.tags,
    availability: item.availability,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function loadItemsFromJson(parsed, stampIso) {
  const nextItems = [];
  let nextId = 1;

  ['player', 'gm'].forEach((section) => {
    const sectionItems = Array.isArray(parsed[section]) ? parsed[section] : [];
    sectionItems.forEach((item) => {
      const normalized = {
        id: String(nextId),
        section,
        title: sanitizeString(item && item.title),
        available: sanitizeString(item && item.available),
        description: sanitizeString(item && item.description),
        tags: sanitizeDisplayTags(item && item.tags),
        availability: sanitizeAvailability(item && item.availability),
        createdAt: toIsoString(item && item.createdAt) || stampIso,
        updatedAt: toIsoString(item && item.updatedAt) || stampIso,
      };
      normalized._search = buildSearchIndex(normalized);
      nextItems.push(normalized);
      nextId += 1;
    });
  });

  return nextItems;
}

async function loadKnowledgeCollection() {
  const raw = await fs.readFile(SEED_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  const stampIso = new Date().toISOString();
  const nextItems = loadItemsFromJson(parsed, stampIso);

  itemsCache = nextItems;
  byIdCache = new Map(nextItems.map((item) => [item.id, item]));
  loaded = true;
  loadedAt = stampIso;

  return {
    loaded: true,
    reloaded: true,
    source: 'json',
    count: nextItems.length,
    loadedAt,
  };
}

async function ensureLoaded() {
  if (loaded) return;
  await loadKnowledgeCollection();
}

function sanitizeAvailabilityFilters(filters = {}) {
  const result = {};

  AVAILABILITY_AXES.forEach((axis) => {
    if (!Object.prototype.hasOwnProperty.call(filters, axis)) return;
    const value = normalizeAvailabilityValue(axis, filters[axis]);
    if (value) {
      result[axis] = value;
    }
  });

  return result;
}

function matchesAvailabilityFilter(item, availabilityFilters) {
  const entries = Object.entries(availabilityFilters);
  if (!entries.length) return true;

  return entries.every(([axis, selectedValue]) => {
    const rule = item.availability && typeof item.availability === 'object'
      ? item.availability[axis]
      : null;
    const normalizedRule = sanitizeAvailabilityRule(rule, createAllRule(), axis);

    if (normalizedRule.op === 'all') return true;
    if (normalizedRule.op === 'in') return normalizedRule.values.includes(selectedValue);
    if (normalizedRule.op === 'not_in') return !normalizedRule.values.includes(selectedValue);
    return true;
  });
}

function filterItems({ section = '', q = '', tags = [], availabilityFilters = {} } = {}) {
  const cleanSection = sanitizeSection(section);
  const cleanQuery = sanitizeString(q).toLowerCase();
  const cleanTags = sanitizeTags(tags);
  const cleanAvailabilityFilters = sanitizeAvailabilityFilters(availabilityFilters);

  return itemsCache.filter((item) => {
    if (cleanSection && item.section !== cleanSection) return false;

    if (cleanTags.length && !cleanTags.every((tag) => item.tags.includes(tag))) {
      return false;
    }

    if (cleanQuery && !item._search.includes(cleanQuery)) {
      return false;
    }

    return matchesAvailabilityFilter(item, cleanAvailabilityFilters);
  });
}

async function initKnowledgeCollection({ forceReload = false } = {}) {
  if (!loaded || forceReload) {
    return loadKnowledgeCollection();
  }

  return {
    loaded: true,
    reloaded: false,
    source: 'json',
    count: itemsCache.length,
    loadedAt,
  };
}

function isValidKnowledgeId(id) {
  return normalizeKnowledgeId(id) != null;
}

async function listKnowledgeItems({ section = '', q = '', tags = [], availabilityFilters = {}, limit = 200, offset = 0 } = {}) {
  await ensureLoaded();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 200, 500));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const filtered = filterItems({ section, q, tags, availabilityFilters });
  return filtered.slice(safeOffset, safeOffset + safeLimit).map(toPublicItem);
}

async function countKnowledgeItems(filters = {}) {
  await ensureLoaded();
  return filterItems(filters).length;
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
  await ensureLoaded();
  const knowledgeId = normalizeKnowledgeId(id);
  if (!knowledgeId) return null;

  const item = byIdCache.get(String(knowledgeId));
  if (!item) return null;
  return toPublicItem(item);
}

module.exports = {
  initKnowledgeCollection,
  isValidKnowledgeId,
  listKnowledgeItems,
  countKnowledgeItems,
  groupKnowledgeItems,
  getKnowledgeById,
};
