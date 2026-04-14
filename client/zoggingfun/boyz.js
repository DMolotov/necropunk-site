(function () {
  var STORAGE_KEY = "zoggingfun.character.v1";

  function readCharacterState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {};
      }
      return JSON.parse(raw) || {};
    } catch (error) {
      return {};
    }
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function textOrFallback(value, fallback) {
    if (typeof value === "number") {
      return String(value);
    }

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    return fallback;
  }

  function setText(id, value, fallback) {
    var node = byId(id);
    if (!node) {
      return;
    }
    node.textContent = textOrFallback(value, fallback);
  }

  function setImage(id, src, fallbackSrc) {
    var node = byId(id);
    if (!node) {
      return;
    }
    node.src = textOrFallback(src, fallbackSrc);
  }

  function render() {
    var state = readCharacterState();
    var identity = state.identity || {};
    var stats = state.stats || {};
    var clan = state.clan || {};

    var name = textOrFallback(identity.name, "Безымянный");
    var nickname = textOrFallback(identity.nickname, "без кликухи");
    var origin = textOrFallback(identity.origin, "Откуда-то из WAAAGH!");
    var hits = stats.hits;

    setText("boyz-full-name", name + " \"" + nickname + "\"", "Безымянный \"без кликухи\"");
    setText("boyz-origin", origin, "Откуда-то из WAAAGH!");

    setText("stat-might", stats.might, "—");
    setText("stat-bahalo", stats.bahalo, "—");
    setText("stat-cunning", stats.cunning, "—");
    setText("stat-waagh", stats.waagh, "—");

    setText("boyz-hits", hits, "—");
    setText("boyz-hp-rank", stats.hpRank, "Характер стойкости не определён");
    setImage("boyz-hp-image", stats.hpImage, "./ork-face.webp");

    setText("boyz-clan-name", clan.label, "Клан не выбран");
    setText("boyz-clan-bonus", clan.bonus, "—");
    setText("boyz-clan-passive", clan.passive, "—");
    setImage("boyz-clan-icon", clan.icon, "./ork-face.webp");
  }

  render();
}());
