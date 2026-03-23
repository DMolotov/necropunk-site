const UI_LABEL_NAME = 'Название';
const UI_LABEL_AVAILABLE = 'Доступно';
const UI_LABEL_DESCRIPTION = 'Описание';
const UI_ERROR_LOAD = 'Не удалось загрузить знания.';
const UI_ERROR_HINT = 'Проверьте, что backend доступен.';
const PAGE_LIMIT = 500;

function buildKnowledgeApiUrls() {
  return ['/api/knowledge'];
}

function buildKnowledgeItemsApiUrls() {
  return buildKnowledgeApiUrls().map((baseUrl) => `${baseUrl.replace(/\/$/, '')}/items`);
}

function appendQuery(url, query) {
  const queryString = query.toString();
  if (!queryString) return url;
  return `${url}?${queryString}`;
}

function sanitizeList(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function normalizeAxisValue(axis, value) {
  void axis;
  return String(value || '').trim().toLowerCase();
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

function buildItemsQuery({ section, q, tags, axisFilters, limit = PAGE_LIMIT, offset = 0 }) {
  const query = new URLSearchParams();

  if (section) query.set('section', section);
  if (q) query.set('q', q);
  sanitizeList(tags).forEach((tag) => query.append('tag', tag));

  Object.entries(axisFilters || {}).forEach(([axis, value]) => {
    if (!value) return;
    query.set(axis, value);
  });

  query.set('limit', String(limit));
  query.set('offset', String(offset));
  return query;
}

async function loadKnowledgeItems(filters) {
  const candidates = buildKnowledgeItemsApiUrls();
  const query = buildItemsQuery(filters);
  const failures = [];

  for (const baseUrl of candidates) {
    const url = appendQuery(baseUrl, query);

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
      return Array.isArray(data.items) ? data.items : [];
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

function debounce(fn, delayMs) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

function setupKnowledgeSection(sectionEl, sectionKey) {
  const searchInput = sectionEl.querySelector('[data-knowledge-search]');
  const filterContainer = sectionEl.querySelector('[data-knowledge-filters]');
  const listEl = sectionEl.querySelector('[data-knowledge-list]');
  const emptyEl = sectionEl.querySelector('[data-knowledge-empty]');
  let requestVersion = 0;

  async function render() {
    const currentVersion = requestVersion + 1;
    requestVersion = currentVersion;

    const q = ((searchInput && searchInput.value) || '').trim();
    const axisFilters = readAxisFilters(filterContainer);
    const tags = readTagFilters(filterContainer);

    try {
      const items = await loadKnowledgeItems({
        section: sectionKey,
        q,
        tags,
        axisFilters,
        limit: PAGE_LIMIT,
        offset: 0,
      });

      if (currentVersion !== requestVersion) return;

      if (listEl) {
        listEl.innerHTML = '';
        items.forEach((item, index) => {
          listEl.appendChild(createKnowledgeItem(item, sectionKey, index));
        });
      }

      if (emptyEl) {
        emptyEl.textContent = 'Ничего не найдено.';
        emptyEl.classList.toggle('hidden', items.length > 0);
      }
    } catch (error) {
      if (currentVersion !== requestVersion) return;
      console.error(error);

      if (listEl) listEl.innerHTML = '';
      if (emptyEl) {
        emptyEl.textContent = `${UI_ERROR_LOAD} ${UI_ERROR_HINT}`;
        emptyEl.classList.remove('hidden');
      }
    }
  }

  const debouncedRender = debounce(render, 180);

  if (searchInput) {
    searchInput.addEventListener('input', debouncedRender);
  }

  if (filterContainer) {
    filterContainer.addEventListener('change', render);
  }

  render();
}

function initKnowledgePage() {
  document.querySelectorAll('[data-knowledge-section]').forEach((section) => {
    const sectionKey = section.getAttribute('data-knowledge-section');
    if (!sectionKey) return;
    setupKnowledgeSection(section, sectionKey);
  });
}

initKnowledgePage();
