/* global module */
(function initThresholdRegistry(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.ThresholdRegistry = factory();
}(typeof globalThis !== 'undefined' ? globalThis : window, function createThresholdRegistry() {
  const registry = new Map();

  function _normalizeEntry(entry) {
    if (typeof entry === 'function') {
      return { condition: () => true, apply: entry, description: '' };
    }
    const condition = typeof entry.condition === 'function' ? entry.condition : () => true;
    const apply = typeof entry.apply === 'function' ? entry.apply : () => {};
    return { condition, apply, description: entry.description || '' };
  }

  function _readContextValue(context, ctxId) {
    if (!context || !ctxId) return undefined;
    if (context.id === ctxId) return context.value;
    return context[ctxId];
  }

  function _matchesWhen(when, context) {
    if (!when) return true;
    const value = _readContextValue(context, when.ctxId);

    if (when.equals !== undefined) return value === when.equals;
    if (Array.isArray(when.in)) return when.in.includes(value);
    if (when.includes !== undefined) {
      if (Array.isArray(value)) return value.includes(when.includes);
      if (typeof value === 'string') return value === when.includes;
      return false;
    }
    if (typeof when.test === 'function') return !!when.test(value, context);

    return !!value;
  }

  function _resolveAbility(effect, context) {
    if (effect.ability) return effect.ability;

    if (effect.chooseFromContextKey) {
      const fromContext = context && context[effect.chooseFromContextKey];
      if (typeof fromContext === 'string' && fromContext) return fromContext;
    }

    if (Array.isArray(effect.chooseFrom) && effect.chooseFrom.length > 0) {
      const idx = Math.floor(Math.random() * effect.chooseFrom.length);
      return effect.chooseFrom[idx];
    }

    return null;
  }

  function _applyEffect(thresholds, effect, context) {
    const abilityKey = _resolveAbility(effect, context);
    if (!abilityKey) return;

    if (typeof effect.set === 'number') {
      thresholds[abilityKey] = effect.set;
    }
    if (typeof effect.add === 'number') {
      thresholds[abilityKey] = (thresholds[abilityKey] || 0) + effect.add;
    }
    if (typeof effect.mul === 'number') {
      thresholds[abilityKey] = (thresholds[abilityKey] || 0) * effect.mul;
    }
  }

  function register(id, entry) {
    if (!id) throw new Error('Threshold id is required');
    registry.set(id, _normalizeEntry(entry));
  }

  function unregister(id) {
    return registry.delete(id);
  }

  function get(id) {
    return registry.get(id);
  }

  function registerConfig(config) {
    if (!config || !config.id) throw new Error('config.id required');

    const condition = (character, context = {}) => _matchesWhen(config.when, context);
    const apply = (character, context = {}) => {
      character.thresholds = character.thresholds || {};
      if (!Array.isArray(config.effects)) return;

      for (const effect of config.effects) {
        _applyEffect(character.thresholds, effect, context);
      }
    };

    register(config.id, { condition, apply, description: config.description });
  }

  function evaluate(character, context = {}, opts = {}) {
    const applied = [];

    for (const [id, entry] of registry.entries()) {
      try {
        if (entry.condition(character, context, opts)) {
          entry.apply(character, context, opts);
          applied.push(id);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('ThresholdRegistry error for', id, error);
      }
    }

    return applied;
  }

  function evaluateForId(id, character, context = {}, opts = {}) {
    const entry = registry.get(id);
    if (!entry) return false;

    try {
      if (entry.condition(character, context, opts)) {
        entry.apply(character, context, opts);
        return true;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('ThresholdRegistry error for', id, error);
    }

    return false;
  }

  async function loadFromLoader(loader) {
    if (typeof loader !== 'function') throw new Error('loader must be a function');

    const configs = await loader();
    if (!Array.isArray(configs)) return;

    for (const config of configs) {
      try {
        registerConfig(config);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to register config', config && config.id, error);
      }
    }
  }

  function list() {
    return Array.from(registry.keys());
  }

  return {
    register,
    unregister,
    get,
    registerConfig,
    evaluate,
    evaluateForId,
    loadFromLoader,
    list,
    _registry: registry,
  };
}));
