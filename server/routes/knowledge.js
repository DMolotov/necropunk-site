const express = require('express');
const {
  isValidKnowledgeId,
  listKnowledgeItems,
  countKnowledgeItems,
  groupKnowledgeItems,
  getKnowledgeById,
} = require('../lib/knowledge');

const router = express.Router();
const READ_ONLY_ERROR = { error: 'knowledge catalog is read-only in JSON mode' };

function parseTagQuery(query) {
  const fromTag = Array.isArray(query.tag) ? query.tag : (query.tag ? [query.tag] : []);
  const fromTags = typeof query.tags === 'string'
    ? query.tags.split(',')
    : [];
  return [...fromTag, ...fromTags]
    .map((tag) => String(tag).trim())
    .filter(Boolean);
}

function parsePagination(query) {
  const limit = Math.max(1, Math.min(Number(query.limit) || 200, 500));
  const offset = Math.max(0, Number(query.offset) || 0);
  return { limit, offset };
}

function parseAvailabilityQuery(query) {
  const filters = {};

  if (typeof query.infected === 'string' && query.infected.trim()) {
    filters.infected = query.infected.trim();
  }

  if (typeof query.work === 'string' && query.work.trim()) {
    filters.work = query.work.trim();
  }

  return filters;
}

function respondReadOnly(res) {
  res.set('Allow', 'GET');
  return res.status(405).json(READ_ONLY_ERROR);
}

router.get('/', async (req, res, next) => {
  try {
    const section = typeof req.query.section === 'string' ? req.query.section.trim() : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const tags = parseTagQuery(req.query);
    const availabilityFilters = parseAvailabilityQuery(req.query);

    if (section && section !== 'player' && section !== 'gm') {
      return res.status(400).json({ error: 'section must be either "player" or "gm"' });
    }

    const items = await listKnowledgeItems({
      section,
      q,
      tags,
      availabilityFilters,
      limit: 500,
      offset: 0,
    });
    const grouped = groupKnowledgeItems(items);

    return res.json(section ? { [section]: grouped[section] || [] } : grouped);
  } catch (error) {
    return next(error);
  }
});

router.get('/items', async (req, res, next) => {
  try {
    const section = typeof req.query.section === 'string' ? req.query.section.trim() : '';
    if (section && section !== 'player' && section !== 'gm') {
      return res.status(400).json({ error: 'section must be either "player" or "gm"' });
    }

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const tags = parseTagQuery(req.query);
    const availabilityFilters = parseAvailabilityQuery(req.query);
    const { limit, offset } = parsePagination(req.query);

    const [items, total] = await Promise.all([
      listKnowledgeItems({ section, q, tags, availabilityFilters, limit, offset }),
      countKnowledgeItems({ section, q, tags, availabilityFilters }),
    ]);

    return res.json({ items, total, limit, offset });
  } catch (error) {
    return next(error);
  }
});

router.get('/items/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidKnowledgeId(id)) {
      return res.status(400).json({ error: 'invalid knowledge id' });
    }

    const item = await getKnowledgeById(id);
    if (!item) {
      return res.status(404).json({ error: 'knowledge item not found' });
    }

    return res.json(item);
  } catch (error) {
    return next(error);
  }
});

router.post('/items', (req, res) => {
  void req;
  return respondReadOnly(res);
});

router.put('/items/:id', (req, res) => {
  void req;
  return respondReadOnly(res);
});

router.patch('/items/:id', (req, res) => {
  void req;
  return respondReadOnly(res);
});

router.delete('/items/:id', (req, res) => {
  void req;
  return respondReadOnly(res);
});

module.exports = router;
