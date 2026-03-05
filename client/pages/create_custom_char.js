function showSheet(num) {
    document.querySelectorAll('.sheet').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const sheet =
        document.getElementById('sheet' + num) ||
        document.getElementById('sheets' + num);
    const btn = document.getElementById('btn' + num);
    if (sheet) sheet.classList.add('active');
    if (btn) btn.classList.add('active');
}

function previewImage(input) {
    const preview = document.getElementById('photo-preview');
    if (!preview || !input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = e => {
        const data = e.target.result;
        if (preview.tagName && preview.tagName.toLowerCase() === 'img') {
            preview.src = data;
        } else {
            preview.style.backgroundImage = `url('${data}')`;
            preview.style.backgroundSize = 'cover';
            preview.style.backgroundPosition = 'center';
        }
    };
    reader.readAsDataURL(file);
}

function recalc(type) {
    const maxInput = document.getElementById(type + '_max');
    const curInput = document.getElementById(type + '_cur');
    const max = parseInt(maxInput && maxInput.value) || 0;
    const cur = parseInt(curInput && curInput.value) || 0;
    let v75 = Math.ceil(max * 0.75);
    let v50 = Math.ceil(max * 0.50);
    let v25 = Math.ceil(max * 0.25);
    if (max > 1 && v75 === max) {
        v75 = Math.max(1, max - 1);
    }
    if (v25 < 1) v25 = 1;
    if (v50 > max) v50 = max;
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    setText(type + '_res_75', v75);
    setText(type + '_res_50', v50);
    setText(type + '_res_25', v25);
    const applyHighlight = (boxId, condition, cls) => {
        const el = document.getElementById(boxId);
        if (!el) return;
        if (condition) el.classList.add(cls); else el.classList.remove(cls);
    };
    applyHighlight(type + '_box_75', cur <= v75, 'hl-75');
    applyHighlight(type + '_box_50', cur <= v50, 'hl-50');
    applyHighlight(type + '_box_25', cur <= v25, 'hl-25');
}

// Alias used by HTML for `oz` inputs
function calculate(type) { recalc(type); }

// Ability system (Водова-Ликерта)
const ABILITIES = [
    { key: 'accuracy', name: 'МЕТКОСТЬ' },
    { key: 'strength', name: 'СИЛА' },
    { key: 'analysis', name: 'АНАЛИЗ' },
    { key: 'cunning', name: 'ХИТРОСТЬ' },
    { key: 'endurance', name: 'ВЫНОСЛИВОСТЬ' },
    { key: 'composure', name: 'ВЫДЕРЖКА' },
];

const ABILITY_KEYS = ABILITIES.map(a => a.key);
const EFF_THRESHOLD_EMPTY = '—';

// Configuration for ability allocation
const AB_BASE = 20;        // baseline value shown at start
const AB_START_POINTS = 75; // total points available to distribute
//TODO: выше поменять AB_START_POINTS на 50, чтобы вернуть базовую логику. Пока не трогать.
const AB_MAX_EXTRA = 90;   // max extra points per ability (on top of base)
//TODO: выше поменять AB_MAX_EXTRA на 20, чтобы вернуть базовую логику. Пока не трогать.

function initThresholdRegistryConfigs() {
    const registry = window.ThresholdRegistry;
    if (!registry || initThresholdRegistryConfigs.done) return;

    if (!registry.get('infection_type_chuchelo_efficiency')) {
        registry.registerConfig({
            id: 'infection_type_chuchelo_efficiency',
            when: { ctxId: 'infection_type', equals: 'Чучело' },
            effects: [
                { ability: 'metkost', set: 50 },
                { ability: 'sila', set: 50 },
            ],
            description: 'Чучело: МЕТКОСТЬ и СИЛА имеют порог эффективности 50',
        });
    }

    if (!registry.get('temporary_weakness_sharper_than_steel')) {
        registry.registerConfig({
            id: 'temporary_weakness_sharper_than_steel',
            when: {
                ctxId: 'temporaryWeaknesses',
                test: value => {
                    if (Array.isArray(value)) return value.includes('SharperThanSteel');
                    return value === 'SharperThanSteel';
                },
            },
            effects: [
                {
                    chooseFrom: ABILITY_KEYS,
                    chooseFromContextKey: 'sharperThanSteelAbility',
                    add: -20,
                },
            ],
            description: 'SharperThanSteel: выбранное Умение получает -20 к порогу эффективности',
        });
    }

    initThresholdRegistryConfigs.done = true;
}

function getFieldValueById(id) {
    const el = document.getElementById(id);
    if (!el) return undefined;

    if (el.tagName === 'SELECT' && el.multiple) {
        return Array.from(el.selectedOptions).map(option => option.value).filter(Boolean);
    }

    if (typeof el.value === 'string') return el.value;
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
        ?? getFieldValueById('temperaryWeaknesses');

    const weaknessList = toWeaknessList(rawWeaknesses);
    const selectedAbility = getFieldValueById('sharpThanSteelAbility');

    return {
        infection_type: infectionType,
        temporaryWeaknesses: weaknessList,
        temperaryWeaknesses: weaknessList,
        sharpThanSteelAbility: selectedAbility,
    };
}

function evaluateEfficiencyThresholds(context) {
    const registry = window.ThresholdRegistry;
    const character = { thresholds: {} };

    if (!registry) {
        if (context.infection_type === 'Чучело') {
            character.thresholds.metkost = 50;
            character.thresholds.sila = 50;
        }
        return character.thresholds;
    }

    registry.evaluate(character, context);
    return character.thresholds;
}

function setupAbilities() {
    const container = document.getElementById('ability');
    if (!container) return;

    const rows = ABILITIES.map(a => {
        return `
            <div class="ability-row flex items-center gap-4 py-1">
                <div class="w-1/3 text-sm font-bold">${a.name}</div>
                <div class="w-1/6"><input type="number" id="ability_val_${a.key}" min="0" max="${AB_BASE + AB_MAX_EXTRA}" value="${AB_BASE}" class="w-full text-center border-0 text-lg font-bold"/></div>
                <div class="w-1/6 text-center"><span id="ability_eff_${a.key}">${EFF_THRESHOLD_EMPTY}</span></div>
                <div class="w-1/6 text-center"><span id="ability_dev_${a.key}">${EFF_THRESHOLD_EMPTY}</span></div>
            </div>`;
    }).join('');

    container.innerHTML = `
        <h2 class="border-b-2 border-black font-bold uppercase text-sm mb-4">Развитие по шкале Водова-Ликерта</h2>
        <div class="ability-table">
            <div class="ability-header flex items-center gap-4 font-semibold mb-2">
                <div class="w-1/3">УМЕНИЕ</div>
                <div class="w-1/6 text-center">ЗНАЧ.</div>
                <div class="w-1/6 text-center">ПОРОГ ЭФФ.</div>
                <div class="w-1/6 text-center">ПОРОГ РАЗВ.</div>
            </div>
            <div id="ability_points_counter" class="text-sm font-semibold text-right mb-2">Непотраченные очки: <span id="ability_points_val">${AB_START_POINTS}</span></div>
            ${rows}
        </div>
    `;

    const inputs = Array.from(container.querySelectorAll('input[id^="ability_val_"]'));

    function totalAllocated() {
        return inputs.reduce((sum, inp) => {
            const v = parseInt(inp.value) || 0;
            return sum + Math.max(0, v - AB_BASE);
        }, 0);
    }

    const counterEl = document.getElementById('ability_points_val');
    const counterWrapper = document.getElementById('ability_points_counter');

    function refreshCounter() {
        const used = totalAllocated();
        const remaining = Math.max(0, AB_START_POINTS - used);
        if (counterEl) counterEl.innerText = remaining;
        if (counterWrapper) counterWrapper.style.display = (remaining <= 0) ? 'none' : 'block';
    }

    inputs.forEach(inp => {
        inp.setAttribute('min', '0');
        inp.setAttribute('max', String(AB_BASE + AB_MAX_EXTRA));
        if (!inp.value) inp.value = AB_BASE;

        inp.addEventListener('input', () => {
            let val = parseInt(inp.value) || 0;
            if (val < 0) val = 0;
            if (val > AB_BASE + AB_MAX_EXTRA) val = AB_BASE + AB_MAX_EXTRA;

            const otherAllocated = inputs.reduce((sum, other) => {
                if (other === inp) return sum;
                const ov = parseInt(other.value) || 0;
                return sum + Math.max(0, ov - AB_BASE);
            }, 0);

            const allowedExtra = Math.max(0, Math.min(AB_MAX_EXTRA, AB_START_POINTS - otherAllocated));
            const desiredExtra = Math.max(0, val - AB_BASE);
            const finalExtra = Math.min(desiredExtra, allowedExtra);
            inp.value = AB_BASE + finalExtra;

            refreshCounter();
        });
    });

    refreshCounter();
    updateAbilityThresholds();
}

function updateAbilityThresholds() {
    const infectionType = document.getElementById('infection_type');
    const devThreshold = (infectionType && infectionType.value === 'Живчик') ? 70 : 95;
    const context = readThresholdContext();
    const thresholds = evaluateEfficiencyThresholds(context);

    ABILITIES.forEach(a => {
        const effEl = document.getElementById(`ability_eff_${a.key}`);
        const devEl = document.getElementById(`ability_dev_${a.key}`);

        if (devEl) devEl.innerText = devThreshold;

        if (effEl) {
            const value = thresholds[a.key];
            effEl.innerText = Number.isFinite(value) ? value : EFF_THRESHOLD_EMPTY;
        }
    });
}

function updateRegForInfection() {
    const sel = document.getElementById('infection_type');
    const reg = document.getElementById('osank_reg');
    if (!sel || !reg) return;
    const NEEDS = 'Не требуется';
    if (sel.value === 'Живчик') {
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
        el.style.height = `${el.scrollHeight}px`;
    };

    fields.forEach((field) => {
        autoGrow(field);
        field.addEventListener('input', () => autoGrow(field));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initThresholdRegistryConfigs();

    recalc('os');
    recalc('oz');

    const infectionType = document.getElementById('infection_type');
    if (infectionType) {
        infectionType.addEventListener('change', () => {
            updateRegForInfection();
            updateAbilityThresholds();
        });
        updateRegForInfection();
    }

    const temporaryWeaknesses = document.getElementById('temporaryWeaknesses')
        || document.getElementById('temperaryWeaknesses');
    if (temporaryWeaknesses) {
        temporaryWeaknesses.addEventListener('change', updateAbilityThresholds);
    }

    const sharpThanSteelAbility = document.getElementById('sharpThanSteelAbility');
    if (sharpThanSteelAbility) {
        sharpThanSteelAbility.addEventListener('change', updateAbilityThresholds);
    }

    setupAbilities();
    initSheet2AutoGrow();
});
