const knowledgeData = {
  player: [
    {
      title: 'Я то, что я ем',
      available: 'Заражённым',
      description: 'Употребление свежей человеческой плоти обостряет ваши хищные инстинкты, позволяя легче манипулировать и обманывать других. Поедание человеческой плоти раз в день даёт МС -10 к проверкам Умения хитрости.',
      tags: ['tag_bonus', 'tag_deadman', 'tag_ghoul'],
    },
    {
      title: 'Тёмный следопыт',
      available: 'Всем персонажам',
      description: 'Вы умеете читать следы и поведение толпы в руинах города. При выслеживании цели в знакомом районе получаете МС -10 к проверкам анализа.',
      tags: ['tag_bonus', 'tag_livingboy'],
    },
    {
      title: 'Уличная репутация',
      available: 'Живчикам и санкционированным',
      description: 'Ваше имя знают в нужных кварталах. В нарративных сценах переговоров с местными бандами вы получаете преимущество на решение мастера.',
      tags: ['tag_source', 'tag_livingboy'],
    },
  ],
  gm: [
    {
      title: 'Живой щит',
      available: 'Противникам ближнего боя',
      description: 'Существо хватает ближайшую цель и прикрывается ей, получая МС +10 к проверкам защиты от дальних атак до конца раунда.',
      tags: ['tag_scarecrow'],
    },
    {
      title: 'Голодный рывок',
      available: 'Заражённым противникам',
      description: 'Если цель ранена, противник получает дополнительное перемещение и может сразу провести одну атаку без затрат стандартного действия.',
      tags: ['tag_bonus', 'tag_ghoul'],
    },
    {
      title: 'Холодный расчёт',
      available: 'Элитным противникам',
      description: 'После провала атаки противник анализирует защиту жертвы. Следующая атака по той же цели получает МС -10.',
      tags: ['tag_source', 'tag_bonus', 'tag_golem'],
    },
  ],
};

function createKnowledgeItem(item, sectionKey, idx) {
  const wrapper = document.createElement('article');
  wrapper.className = 'grid';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'knowledge-trigger rounded-sm';
  button.setAttribute('aria-expanded', 'false');

  const panelId = `${sectionKey}-knowledge-${idx}`;
  button.setAttribute('aria-controls', panelId);
  button.innerHTML = `<span class="font-semibold">Название: ${item.title}</span>`;

  const panel = document.createElement('div');
  panel.id = panelId;
  panel.className = 'knowledge-panel rounded-b-sm';
  panel.innerHTML = `
    <p><strong class="text-gold">Название:</strong> ${item.title}</p>
    <p><strong class="text-gold">Доступно:</strong> ${item.available}</p>
    <p><strong class="text-gold">Описание:</strong> ${item.description}</p>
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

function setupKnowledgeSection(sectionEl, sectionKey) {
  const searchInput = sectionEl.querySelector('[data-knowledge-search]');
  const filterContainer = sectionEl.querySelector('[data-knowledge-filters]');
  const infectedTypeSelect = filterContainer.querySelector('select[id^="tag_infected_type"]');
  const listEl = sectionEl.querySelector('[data-knowledge-list]');
  const emptyEl = sectionEl.querySelector('[data-knowledge-empty]');
  const allItems = knowledgeData[sectionKey] || [];

  function render() {
    const query = (searchInput.value || '').trim().toLowerCase();
    const selectedTags = Array
      .from(filterContainer.querySelectorAll('input[type="checkbox"]:checked'))
      .map((input) => input.value);
    const selectedInfectedTag = infectedTypeSelect ? infectedTypeSelect.value : '';

    const filtered = allItems.filter((item) => {
      const text = `${item.title} ${item.available} ${item.description}`.toLowerCase();
      const byQuery = !query || text.includes(query);
      const byTags = selectedTags.length === 0 || selectedTags.every((tag) => item.tags.includes(tag));
      const byInfectedType = !selectedInfectedTag || item.tags.includes(selectedInfectedTag);
      return byQuery && byTags && byInfectedType;
    });

    listEl.innerHTML = '';
    filtered.forEach((item, idx) => {
      listEl.appendChild(createKnowledgeItem(item, sectionKey, idx));
    });
    emptyEl.classList.toggle('hidden', filtered.length > 0);
  }

  searchInput.addEventListener('input', render);
  filterContainer.addEventListener('change', render);
  render();
}

document.querySelectorAll('[data-knowledge-section]').forEach((section) => {
  const sectionKey = section.getAttribute('data-knowledge-section');
  setupKnowledgeSection(section, sectionKey);
});
