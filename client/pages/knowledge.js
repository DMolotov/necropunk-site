const UI_LABEL_NAME = 'Название';
const UI_LABEL_AVAILABLE = 'Доступно';
const UI_LABEL_DESCRIPTION = 'Описание';
const UI_ERROR_LOAD = 'Не удалось загрузить знания.';
const UI_ERROR_HINT = 'Проверьте, что backend доступен на http://localhost:3000.';

function buildKnowledgeApiUrls() {
  const urls = ['/api/knowledge'];
  const locationProtocol = window.location && window.location.protocol ? window.location.protocol : '';
  const protocol = /^https?:$/.test(locationProtocol) ? locationProtocol : 'http:';
  const host = window.location && window.location.hostname ? window.location.hostname : '';
  const hosts = [];

  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    hosts.push(host);
  }

  hosts.push('localhost', '127.0.0.1');

  hosts.forEach((candidateHost) => {
    urls.push(`${protocol}//${candidateHost}:3000/api/knowledge`);
  });

  return Array.from(new Set(urls));
}

async function loadKnowledgeData() {
  const candidates = buildKnowledgeApiUrls();
  const failures = [];

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        failures.push(`${url}: HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();
      return {
        player: Array.isArray(data.player) ? data.player : [],
        gm: Array.isArray(data.gm) ? data.gm : [],
      };
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      failures.push(`${url}: ${message}`);
    }
  }

  throw new Error(`Failed to load knowledge data. ${failures.join('; ')}`);
}

function createKnowledgeItem(item, sectionKey, idx) {
  const wrapper = document.createElement('article');
  wrapper.className = 'grid';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'knowledge-trigger rounded-sm';
  button.setAttribute('aria-expanded', 'false');

  const panelId = `${sectionKey}-knowledge-${idx}`;
  button.setAttribute('aria-controls', panelId);
  button.innerHTML = `<span class="font-semibold">${UI_LABEL_NAME}: ${item.title}</span>`;

  const panel = document.createElement('div');
  panel.id = panelId;
  panel.className = 'knowledge-panel rounded-b-sm';
  panel.innerHTML = `
    <p><strong class="text-gold">${UI_LABEL_NAME}:</strong> ${item.title}</p>
    <p><strong class="text-gold">${UI_LABEL_AVAILABLE}:</strong> ${item.available}</p>
    <p><strong class="text-gold">${UI_LABEL_DESCRIPTION}:</strong> ${item.description}</p>
  `;

  button.addEventListener('click', () => {
    const isOpen = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!isOpen));
    panel.classList.toggle('open', !isOpen);
  });

  wrapper.appendChild(button);
  wrapper.appendChild(panel);
  return wrapper;
}

function sanitizeList(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function normalizeAxisValue(axis, value) {
  void axis;
  return String(value || '').trim().toLowerCase();
}

function sanitizeAxisValues(axis, values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => normalizeAxisValue(axis, value)).filter(Boolean)));
}

function makeAllRule() {
  return { op: 'all', values: [] };
}

function normalizeRule(rule, axis) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    return makeAllRule();
  }

  const op = String(rule.op || '').trim().toLowerCase();
  if (op !== 'in' && op !== 'not_in' && op !== 'all') {
    return makeAllRule();
  }

  if (op === 'all') {
    return makeAllRule();
  }

  const values = sanitizeAxisValues(axis, rule.values);
  if (!values.length) {
    return makeAllRule();
  }

  return { op, values };
}

function normalizeAvailability(item) {
  const source = item && item.availability && typeof item.availability === 'object'
    ? item.availability
    : {};

  return {
    infected: normalizeRule(source.infected, 'infected'),
    work: normalizeRule(source.work, 'work'),
  };
}

function readAxisFilters(filterContainer) {
  if (!filterContainer) return {};

  const axisFilters = {};
  Array.from(filterContainer.querySelectorAll('[data-filter-axis]')).forEach((input) => {
    const axis = String(input.getAttribute('data-filter-axis') || '').trim();
    if (!axis) return;

    const value = normalizeAxisValue(axis, input.value);
    if (value) {
      axisFilters[axis] = value;
    }
  });

  return axisFilters;
}

function readTagFilters(filterContainer) {
  if (!filterContainer) return [];

  const values = Array.from(filterContainer.querySelectorAll('[data-filter-kind="tag"]'))
    .map((input) => String(input.value || '').trim())
    .filter(Boolean);

  return sanitizeList(values);
}

function matchAvailability(selectedValue, rule, axis) {
  if (!selectedValue) return true;

  const normalizedSelectedValue = normalizeAxisValue(axis, selectedValue);
  const normalizedRule = normalizeRule(rule, axis);
  if (normalizedRule.op === 'all') return true;

  if (normalizedRule.op === 'in') {
    return normalizedRule.values.includes(normalizedSelectedValue);
  }

  if (normalizedRule.op === 'not_in') {
    return !normalizedRule.values.includes(normalizedSelectedValue);
  }

  return true;
}

function setupKnowledgeSection(sectionEl, sectionKey, knowledgeData) {
  const searchInput = sectionEl.querySelector('[data-knowledge-search]');
  const filterContainer = sectionEl.querySelector('[data-knowledge-filters]');
  const listEl = sectionEl.querySelector('[data-knowledge-list]');
  const emptyEl = sectionEl.querySelector('[data-knowledge-empty]');
  const allItems = knowledgeData[sectionKey] || [];

  function render() {
    const query = ((searchInput && searchInput.value) || '').trim().toLowerCase();
    const axisFilters = readAxisFilters(filterContainer);
    const tagFilters = readTagFilters(filterContainer);

    const filtered = allItems.filter((item) => {
      const itemTags = sanitizeList(item.tags);
      const availability = normalizeAvailability(item);
      const text = `${item.title || ''} ${item.available || ''} ${item.description || ''}`.toLowerCase();

      const byQuery = !query || text.includes(query);
      const byTags = tagFilters.length === 0 || tagFilters.every((tag) => itemTags.includes(tag));
      const byAxes = Object.entries(axisFilters).every(([axis, selectedValue]) => matchAvailability(selectedValue, availability[axis], axis));

      return byQuery && byTags && byAxes;
    });

    if (listEl) {
      listEl.innerHTML = '';
      filtered.forEach((item, itemIndex) => {
        listEl.appendChild(createKnowledgeItem(item, sectionKey, itemIndex));
      });
    }

    if (emptyEl) {
      emptyEl.classList.toggle('hidden', filtered.length > 0);
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', render);
  }

  if (filterContainer) {
    filterContainer.addEventListener('change', render);
  }

  render();
}

async function initKnowledgePage() {
  try {
    const knowledgeData = await loadKnowledgeData();
    document.querySelectorAll('[data-knowledge-section]').forEach((section) => {
      const sectionKey = section.getAttribute('data-knowledge-section');
      setupKnowledgeSection(section, sectionKey, knowledgeData);
    });
  } catch (error) {
    console.error(error);
    document.querySelectorAll('[data-knowledge-section]').forEach((section) => {
      const listEl = section.querySelector('[data-knowledge-list]');
      const emptyEl = section.querySelector('[data-knowledge-empty]');
      if (listEl) listEl.innerHTML = '';
      if (emptyEl) {
        emptyEl.textContent = `${UI_ERROR_LOAD} ${UI_ERROR_HINT}`;
        emptyEl.classList.remove('hidden');
      }
    });
  }
}

initKnowledgePage();
