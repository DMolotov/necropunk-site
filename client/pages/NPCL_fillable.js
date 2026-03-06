function loadThresholdRegistry(callback) {
  if (window.ThresholdRegistry) {
    callback();
    return;
  }

  const existing = document.querySelector('script[data-threshold-registry="1"]');
  if (existing) {
    if (existing.dataset.loaded === '1' || window.ThresholdRegistry) {
      callback();
      return;
    }

    const done = function () {
      callback();
    };
    existing.addEventListener('load', done, { once: true });
    existing.addEventListener('error', done, { once: true });
    return;
  }

  const script = document.createElement('script');
  script.src = '/lib/thresholds.js';
  script.async = true;
  script.dataset.thresholdRegistry = '1';
  script.addEventListener('load', function () {
    script.dataset.loaded = '1';
    callback();
  }, { once: true });
  script.addEventListener('error', function () {
    callback();
  }, { once: true });
  document.head.appendChild(script);
}

function showSheet(num) {
  const targetId = 'sheet' + num;
  const pages = document.querySelectorAll('.page[id^="sheet"]');

  pages.forEach((page) => {
    const wrap = page.closest('.page-wrap');
    if (!wrap) return;
    wrap.classList.toggle('is-hidden', page.id !== targetId);
  });

  document.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
  const btn = document.getElementById('btn' + num);
  if (btn) btn.classList.add('active');
}

function previewImage(input) {
  if (!input || !input.files || !input.files[0]) return;

  const preview = document.getElementById('photo-preview');
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = e.target && e.target.result;
    if (!data) return;

    if (preview) {
      preview.style.backgroundImage = "url('" + data + "')";
    } else {
      input.style.backgroundImage = "url('" + data + "')";
      input.style.backgroundSize = 'cover';
      input.style.backgroundPosition = 'center';
    }
  };
  reader.readAsDataURL(file);
}

function setFieldText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if ('value' in el) {
    el.value = String(value);
  } else {
    el.innerText = String(value);
  }
}

function setFieldReadonly(id, readonly) {
  const el = document.getElementById(id);
  if (el && 'readOnly' in el) el.readOnly = readonly;
}

function recalc(type) {
  const maxInput = document.getElementById(type + '_max');
  const curInput = document.getElementById(type + '_cur');
  const max = parseInt(maxInput && maxInput.value, 10) || 0;
  const cur = parseInt(curInput && curInput.value, 10) || 0;

  let v75 = Math.ceil(max * 0.75);
  let v50 = Math.ceil(max * 0.5);
  let v25 = Math.ceil(max * 0.25);

  if (max > 1 && v75 === max) v75 = Math.max(1, max - 1);
  if (v50 > max) v50 = max;
  if (v25 < 1 && max > 0) v25 = 1;

  setFieldText(type + '_res_75', max > 0 ? v75 : '');
  setFieldText(type + '_res_50', max > 0 ? v50 : '');
  setFieldText(type + '_res_25', max > 0 ? v25 : '');

  const applyHighlight = (suffix, active, cls) => {
    const box = document.getElementById(type + '_box_' + suffix);
    const fallback = document.getElementById(type + '_res_' + suffix);
    const target = box || fallback;
    if (!target || !target.classList) return;

    target.classList.remove('hl-75', 'hl-50', 'hl-25');
    if (active) target.classList.add(cls);
  };

  applyHighlight('75', max > 0 && cur <= v75, 'hl-75');
  applyHighlight('50', max > 0 && cur <= v50, 'hl-50');
  applyHighlight('25', max > 0 && cur <= v25, 'hl-25');
}

function calculate(type) {
  recalc(type);
}

const AB_BASE = 20;
const AB_START_POINTS = 75;
const AB_MAX_EXTRA = 90;
const EFF_THRESHOLD_EMPTY = '-';

const ABILITIES = [
  { key: 'accuracy', valueIds: ['accuracy_value'], effIds: ['accuracy_eff'], devIds: ['accuracy_dev'] },
  { key: 'strength', valueIds: ['strength_value'], effIds: ['strength_eff', 'strenght_eff'], devIds: ['strength_dev', 'strenght_dev'] },
  { key: 'analysis', valueIds: ['analysis_value'], effIds: ['analysis_eff'], devIds: ['analysis_dev'] },
  { key: 'cunning', valueIds: ['cunning_value'], effIds: ['cunning_eff'], devIds: ['cunning_dev'] },
  { key: 'endurance', valueIds: ['endurance_value'], effIds: ['endurance_eff'], devIds: ['endurance_dev'] },
  { key: 'composure', valueIds: ['composure_value'], effIds: ['composure_eff'], devIds: ['composure_dev'] }
];

function firstByIds(ids) {
  for (let i = 0; i < ids.length; i += 1) {
    const el = document.getElementById(ids[i]);
    if (el) return el;
  }
  return null;
}

function initThresholdRegistryConfigs() {
  const registry = window.ThresholdRegistry;
  if (!registry || initThresholdRegistryConfigs.done) return;

  if (!registry.get('infection_type_chuchelo_efficiency')) {
    registry.registerConfig({
      id: 'infection_type_chuchelo_efficiency',
      when: { ctxId: 'infection_type', equals: 'Чучело' },
      effects: [
        { ability: 'accuracy', set: 50 },
        { ability: 'strength', set: 50 },
        { ability: 'metkost', set: 50 },
        { ability: 'sila', set: 50 }
      ]
    });
  }

  if (!registry.get('temporary_weakness_sharper_than_steel')) {
    registry.registerConfig({
      id: 'temporary_weakness_sharper_than_steel',
      when: {
        ctxId: 'temporaryWeaknesses',
        test: (value) => Array.isArray(value) && value.includes('SharperThanSteel')
      },
      effects: [
        {
          chooseFrom: ABILITIES.map((ability) => ability.key),
          chooseFromContextKey: 'sharperThanSteelAbility',
          add: -20
        }
      ]
    });
  }

  initThresholdRegistryConfigs.done = true;
}

function getFieldValueById(id) {
  const el = document.getElementById(id);
  if (!el) return undefined;

  if (el.tagName === 'SELECT' && el.multiple) {
    return Array.from(el.selectedOptions).map((option) => option.value).filter(Boolean);
  }

  if ('value' in el) return el.value;
  return undefined;
}

function toWeaknessList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.length > 0) return [value];
  return [];
}

function readThresholdContext() {
  const infectionType = getFieldValueById('infection_type') || '';
  const rawWeaknesses =
    getFieldValueById('temporaryWeaknesses')
    || getFieldValueById('temperaryWeaknesses');
  const selectedAbility =
    getFieldValueById('sharperThanSteelAbility')
    || getFieldValueById('sharpThanSteelAbility');
  const weaknessList = toWeaknessList(rawWeaknesses);

  return {
    infection_type: infectionType,
    temporaryWeaknesses: weaknessList,
    temperaryWeaknesses: weaknessList,
    sharperThanSteelAbility: selectedAbility,
    sharpThanSteelAbility: selectedAbility
  };
}

function normalizeThresholdKeys(thresholds) {
  if (!thresholds) return {};
  if (!Number.isFinite(thresholds.accuracy) && Number.isFinite(thresholds.metkost)) {
    thresholds.accuracy = thresholds.metkost;
  }
  if (!Number.isFinite(thresholds.strength) && Number.isFinite(thresholds.sila)) {
    thresholds.strength = thresholds.sila;
  }
  return thresholds;
}

function evaluateEfficiencyThresholds(context) {
  const registry = window.ThresholdRegistry;
  const character = { thresholds: {} };

  if (!registry) {
    if (context.infection_type === 'Чучело') {
      character.thresholds.accuracy = 50;
      character.thresholds.strength = 50;
    }
    return character.thresholds;
  }

  registry.evaluate(character, context);
  return normalizeThresholdKeys(character.thresholds);
}

function getInfectionTypeValue() {
  const infectionType = document.getElementById('infection_type');
  return (infectionType && infectionType.value || '').trim();
}

function updateAbilityThresholds() {
  const infectionType = getInfectionTypeValue();
  const devThreshold = infectionType === 'Живчик' ? 70 : 95;
  const context = readThresholdContext();
  const thresholds = evaluateEfficiencyThresholds(context);

  ABILITIES.forEach((ability) => {
    const effEl = firstByIds(ability.effIds);
    const devEl = firstByIds(ability.devIds);

    if (devEl) {
      devEl.value = String(devThreshold);
      devEl.readOnly = true;
    }

    if (effEl) {
      const value = thresholds[ability.key];
      effEl.value = Number.isFinite(value) ? String(value) : EFF_THRESHOLD_EMPTY;
      effEl.readOnly = true;
    }
  });
}

function updateRegForInfection() {
  const reg = document.getElementById('osank_reg');
  if (!reg) return;

  const NEEDS = 'Не требуется';
  if (getInfectionTypeValue() === 'Живчик') {
    reg.value = NEEDS;
    reg.readOnly = true;
  } else {
    if (reg.value === NEEDS) reg.value = '';
    reg.readOnly = false;
  }
}

function initSheet2AutoGrow() {
  const fields = document.querySelectorAll('#getted_knowledge .sheet2-autogrow, #getted_flaw .sheet2-autogrow');
  if (!fields.length) return;

  const autoGrow = (el) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  fields.forEach((field) => {
    autoGrow(field);
    field.addEventListener('input', () => autoGrow(field));
  });
}

function initAbilityControls() {
  const valueInputs = ABILITIES.map((ability) => firstByIds(ability.valueIds)).filter(Boolean);
  if (!valueInputs.length) return;

  valueInputs.forEach((input) => {
    input.type = 'number';
    input.min = '0';
    input.max = String(AB_BASE + AB_MAX_EXTRA);
    if (!input.value) input.value = String(AB_BASE);
  });

  const sheet1 = document.getElementById('sheet1');
  let counterWrap = document.getElementById('ability_points_counter');
  if (!counterWrap && sheet1) {
    counterWrap = document.createElement('div');
    counterWrap.id = 'ability_points_counter';
    counterWrap.className = 'ability-points';
    counterWrap.innerHTML = 'Непотраченные очки: <span id="ability_points_val"></span>';
    sheet1.appendChild(counterWrap);
  }
  const counterVal = document.getElementById('ability_points_val');

  function getValue(input) {
    const parsed = parseInt(input.value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function totalAllocated() {
    return valueInputs.reduce((sum, input) => sum + Math.max(0, getValue(input) - AB_BASE), 0);
  }

  function refreshCounter() {
    const remaining = Math.max(0, AB_START_POINTS - totalAllocated());
    if (counterVal) counterVal.innerText = String(remaining);
    if (counterWrap) counterWrap.style.display = remaining <= 0 ? 'none' : 'block';
  }

  valueInputs.forEach((input) => {
    input.addEventListener('input', () => {
      let value = getValue(input);
      if (value < 0) value = 0;
      if (value > AB_BASE + AB_MAX_EXTRA) value = AB_BASE + AB_MAX_EXTRA;

      const otherAllocated = valueInputs.reduce((sum, other) => {
        if (other === input) return sum;
        return sum + Math.max(0, getValue(other) - AB_BASE);
      }, 0);

      const allowedExtra = Math.max(0, Math.min(AB_MAX_EXTRA, AB_START_POINTS - otherAllocated));
      const desiredExtra = Math.max(0, value - AB_BASE);
      const finalExtra = Math.min(desiredExtra, allowedExtra);
      input.value = String(AB_BASE + finalExtra);

      refreshCounter();
    });
  });

  refreshCounter();
}

function initializePageLogic() {
  initThresholdRegistryConfigs();

  const photoInput = document.getElementById('photo-input');
  if (photoInput) photoInput.addEventListener('change', () => previewImage(photoInput));

  const ozCurEl = document.getElementById('oz_cur');
  const ozMaxEl = document.getElementById('oz_max');
  const osCurEl = document.getElementById('os_cur');
  const osMaxEl = document.getElementById('os_max');

  if (!ozCurEl || !ozCurEl.value) setFieldText('oz_cur', 3);
  if (!ozMaxEl || !ozMaxEl.value) setFieldText('oz_max', 3);
  if (!osCurEl || !osCurEl.value) setFieldText('os_cur', 3);
  if (!osMaxEl || !osMaxEl.value) setFieldText('os_max', 3);

  recalc('os');
  recalc('oz');

  ['oz_cur', 'oz_max'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => recalc('oz'));
  });
  ['os_cur', 'os_max'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => recalc('os'));
  });

  const infectionType = document.getElementById('infection_type');
  if (infectionType) {
    infectionType.addEventListener('change', () => {
      updateRegForInfection();
      updateAbilityThresholds();
    });
    infectionType.addEventListener('input', () => {
      updateRegForInfection();
      updateAbilityThresholds();
    });
  }

  const temporaryWeaknesses = document.getElementById('temporaryWeaknesses')
    || document.getElementById('temperaryWeaknesses');
  if (temporaryWeaknesses) {
    temporaryWeaknesses.addEventListener('change', updateAbilityThresholds);
    temporaryWeaknesses.addEventListener('input', updateAbilityThresholds);
  }

  const sharperThanSteelAbility = document.getElementById('sharperThanSteelAbility')
    || document.getElementById('sharpThanSteelAbility');
  if (sharperThanSteelAbility) {
    sharperThanSteelAbility.addEventListener('change', updateAbilityThresholds);
    sharperThanSteelAbility.addEventListener('input', updateAbilityThresholds);
  }

  initAbilityControls();
  updateRegForInfection();
  updateAbilityThresholds();
  initSheet2AutoGrow();
  showSheet(1);

  setFieldReadonly('oz_res_75', true);
  setFieldReadonly('oz_res_50', true);
  setFieldReadonly('oz_res_25', true);
  setFieldReadonly('os_res_75', true);
  setFieldReadonly('os_res_50', true);
  setFieldReadonly('os_res_25', true);
}

function bootstrap() {
  loadThresholdRegistry(() => {
    initializePageLogic();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
