const express = require('express');
const {
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
} = require('../lib/knowledge');

const router = express.Router();

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

router.get('/', async (req, res, next) => {
  try {
    const section = typeof req.query.section === 'string' ? req.query.section.trim() : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const tags = parseTagQuery(req.query);
    const items = await listKnowledgeItems({ section, q, tags, limit: 500, offset: 0 });
    const grouped = groupKnowledgeItems(items);

    if (section && section !== 'player' && section !== 'gm') {
      return res.status(400).json({ error: 'section must be either "player" or "gm"' });
    }

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
    const { limit, offset } = parsePagination(req.query);
    const [items, total] = await Promise.all([
      listKnowledgeItems({ section, q, tags, limit, offset }),
      countKnowledgeItems({ section, q, tags }),
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

router.post('/items', async (req, res, next) => {
  try {
    const { errors, data } = validateKnowledgePayload(req.body, { partial: false });
    if (errors.length) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    const created = await createKnowledgeItem(data);
    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
});

router.put('/items/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidKnowledgeId(id)) {
      return res.status(400).json({ error: 'invalid knowledge id' });
    }

    const { errors, data } = validateKnowledgePayload(req.body, { partial: false });
    if (errors.length) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    const updated = await replaceKnowledgeItemById(id, data);
    if (!updated) {
      return res.status(404).json({ error: 'knowledge item not found' });
    }

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

router.patch('/items/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidKnowledgeId(id)) {
      return res.status(400).json({ error: 'invalid knowledge id' });
    }

    const { errors, data } = validateKnowledgePayload(req.body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    const updated = await updateKnowledgeItemById(id, data);
    if (!updated) {
      return res.status(404).json({ error: 'knowledge item not found' });
    }

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

router.delete('/items/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidKnowledgeId(id)) {
      return res.status(400).json({ error: 'invalid knowledge id' });
    }

    const deleted = await deleteKnowledgeItemById(id);
    if (!deleted) {
      return res.status(404).json({ error: 'knowledge item not found' });
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
