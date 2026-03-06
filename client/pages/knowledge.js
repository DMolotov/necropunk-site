const UI_LABEL_NAME = 'Название';
const UI_LABEL_AVAILABLE = 'Доступно';
const UI_LABEL_DESCRIPTION = 'Описание';
const UI_ERROR_LOAD = 'Не удалось загрузить знания.';

async function loadKnowledgeData() {
  const response = await fetch('/api/knowledge', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to load knowledge data: ${response.status}`);
  }

  const data = await response.json();
  return {
    player: Array.isArray(data.player) ? data.player : [],
    gm: Array.isArray(data.gm) ? data.gm : [],
  };
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

function setupKnowledgeSection(sectionEl, sectionKey, knowledgeData) {
  const searchInput = sectionEl.querySelector('[data-knowledge-search]');
  const filterContainer = sectionEl.querySelector('[data-knowledge-filters]');
  const listEl = sectionEl.querySelector('[data-knowledge-list]');
  const emptyEl = sectionEl.querySelector('[data-knowledge-empty]');
  const allItems = knowledgeData[sectionKey] || [];

  function render() {
    const query = ((searchInput && searchInput.value) || '').trim().toLowerCase();

    const checkboxTags = filterContainer
      ? Array.from(filterContainer.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value)
      : [];

    const selectTags = filterContainer
      ? Array.from(filterContainer.querySelectorAll('select')).map((select) => select.value)
      : [];

    const selectedTags = [...checkboxTags, ...selectTags].filter(Boolean);

    const filtered = allItems.filter((item) => {
      const text = `${item.title} ${item.available} ${item.description}`.toLowerCase();
      const byQuery = !query || text.includes(query);
      const byTags = selectedTags.length === 0 || selectedTags.every((tag) => item.tags.includes(tag));
      return byQuery && byTags;
    });

    if (listEl) {
      listEl.innerHTML = '';
      filtered.forEach((item, idx) => {
        listEl.appendChild(createKnowledgeItem(item, sectionKey, idx));
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
        emptyEl.textContent = UI_ERROR_LOAD;
        emptyEl.classList.remove('hidden');
      }
    });
  }
}

initKnowledgePage();
