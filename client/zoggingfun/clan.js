(function () {
  var STORAGE_KEY = "zoggingfun.character.v1";
  var grid = document.getElementById("clan-grid");
  var status = document.getElementById("clan-status");
  var resetButton = document.getElementById("clan-reset-btn");

  if (!grid || !status || !resetButton) {
    return;
  }

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

  function writeCharacterState(mutator) {
    try {
      var state = readCharacterState();
      var nextState = mutator(state) || state;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch (error) {
      // ignore storage errors
    }
  }

  function lockGridHeight() {
    var h = grid.offsetHeight;
    if (h > 0) {
      grid.style.height = String(h) + "px";
    }
  }

  function releaseGridHeight() {
    window.setTimeout(function () {
      if (!grid.classList.contains("is-locked")) {
        grid.style.height = "";
      }
    }, 240);
  }

  function buildClanData(card) {
    var quote = card.querySelector(".clan-quote");
    var icon = card.querySelector(".clan-icon");

    return {
      key: card.dataset.clan || "",
      label: card.dataset.label || "",
      quote: quote ? quote.textContent.trim() : "",
      bonus: card.dataset.bonus || "",
      passive: card.dataset.passive || "",
      icon: icon ? icon.getAttribute("src") : ""
    };
  }

  function saveClanState(card) {
    var clanData = buildClanData(card);

    writeCharacterState(function (state) {
      state.clan = clanData;
      return state;
    });
  }

  function clearClanState() {
    writeCharacterState(function (state) {
      state.clan = null;
      return state;
    });
  }

  function clearSelection() {
    grid.classList.remove("is-locked");
    grid.querySelectorAll(".clan-card").forEach(function (item) {
      item.classList.remove("is-selected");
    });
    releaseGridHeight();
    clearClanState();

    status.textContent = "Пацан пока без клана.";
    status.classList.remove("is-ready");
    resetButton.hidden = true;
  }

  function selectClan(card) {
    if (!card) {
      return;
    }

    if (!grid.classList.contains("is-locked")) {
      lockGridHeight();
    }

    grid.querySelectorAll(".clan-card").forEach(function (item) {
      item.classList.remove("is-selected");
    });

    card.classList.add("is-selected");
    grid.classList.add("is-locked");
    status.textContent = "Выбран клан: " + (card.dataset.label || "неизвестно") + ".";
    status.classList.add("is-ready");
    resetButton.hidden = false;
    saveClanState(card);
  }

  function restoreClanState() {
    var saved = readCharacterState();
    var clan = saved.clan || {};
    var key = clan.key;
    var card = null;

    if (!key) {
      return;
    }

    grid.querySelectorAll(".clan-card").forEach(function (item) {
      if (item.dataset.clan === key) {
        card = item;
      }
    });

    if (card) {
      selectClan(card);
    }
  }

  grid.addEventListener("click", function (event) {
    var card = event.target.closest(".clan-card");
    selectClan(card);
  });

  grid.querySelectorAll(".clan-card").forEach(function (card) {
    card.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectClan(card);
      }
    });
  });

  resetButton.addEventListener("click", function () {
    clearSelection();
  });

  restoreClanState();
}());
