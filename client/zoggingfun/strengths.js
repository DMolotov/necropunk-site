(function () {
  var STORAGE_KEY = "zoggingfun.character.v1";
  var statConfig = [
    {
      key: "might",
      label: "СИЛИЩА",
      hint: "рукопашная, выносливость, ломание дверей лбом."
    },
    {
      key: "bahalo",
      label: "БАХАЛО",
      hint: "стрельба, взрывы, умение стрелять «в нужную сторону»."
    },
    {
      key: "cunning",
      label: "ХИТРОСТЬ",
      hint: "скрытность, вождение, ремонт из мусора."
    },
    {
      key: "waagh",
      label: "ГРААА!",
      hint: "вера в невозможное, психические силы, чистая удача."
    }
  ];

  var trackLength = 7;
  var allowedValues = [4, 3, 2, 1];
  var maxStarterValue = 4;

  var selectedByStat = {
    might: null,
    bahalo: null,
    cunning: null,
    waagh: null
  };

  // Пока используем одну заглушку. Позже можно подставить отдельные файлы для 6/7/8/9.
  var defaultHitsImage = "./6hp.png";
  var hitsImageByValue = {
    6: "./6hp.png",
    7: "./7hp.png",
    8: "./8hp.png",
    9: "./9hp.png"
  };

  var list = document.getElementById("stat-list");
  var status = document.getElementById("distribution-status");
  var hpPanel = document.getElementById("hp-panel");
  var hpValue = document.getElementById("hp-value");
  var hpRank = document.getElementById("hp-rank");
  var hpImage = document.getElementById("hp-image");

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

  function getLabelByKey(key) {
    var found = statConfig.find(function (stat) {
      return stat.key === key;
    });
    return found ? found.label : key;
  }

  function findOwnerOfValue(value, exceptKey) {
    var found = statConfig.find(function (stat) {
      return stat.key !== exceptKey && selectedByStat[stat.key] === value;
    });
    return found || null;
  }

  function getHitsValue() {
    if (selectedByStat.might === null) {
      return null;
    }

    return selectedByStat.might + 5;
  }

  function getHitsRank(hits) {
    if (hits === 6) {
      return "Тощий, но злой";
    }

    if (hits === 7) {
      return "Крепкий бойз";
    }

    if (hits === 8) {
      return "Железнолобый";
    }

    if (hits >= 9) {
      return "Почти неубиваемый";
    }

    return "Выбери СИЛИЩА";
  }

  function getHitsImage(hits) {
    if (hits === null) {
      return defaultHitsImage;
    }

    return hitsImageByValue[hits] || defaultHitsImage;
  }

  function saveStatsState() {
    var hits = getHitsValue();

    writeCharacterState(function (state) {
      state.stats = {
        might: selectedByStat.might,
        bahalo: selectedByStat.bahalo,
        cunning: selectedByStat.cunning,
        waagh: selectedByStat.waagh,
        hits: hits,
        hpRank: hits === null ? null : getHitsRank(hits),
        hpImage: getHitsImage(hits)
      };
      return state;
    });
  }

  function restoreStatsState() {
    var saved = readCharacterState();
    var stats = saved.stats || {};
    var used = [];

    statConfig.forEach(function (stat) {
      var value = Number(stats[stat.key]);
      var valid = allowedValues.indexOf(value) !== -1 && used.indexOf(value) === -1;
      selectedByStat[stat.key] = valid ? value : null;
      if (valid) {
        used.push(value);
      }
    });
  }

  function renderRows() {
    if (!list) {
      return;
    }

    list.innerHTML = statConfig.map(function (stat) {
      var dots = [];
      var index;

      for (index = 1; index <= trackLength; index += 1) {
        dots.push(
          "<button type=\"button\" class=\"stat-dot\" data-value=\"" + index + "\" aria-label=\"" +
          stat.label + ", " + index + "\"></button>"
        );
      }

      return (
        "<article class=\"stat-row\" data-stat=\"" + stat.key + "\">" +
          "<span class=\"stat-name\" tabindex=\"0\" data-tooltip=\"" + stat.hint + "\">" + stat.label + "</span>" +
          "<div class=\"dot-track\">" + dots.join("") + "</div>" +
        "</article>"
      );
    }).join("");
  }

  function updateStatus(message, tone) {
    var usedValues;
    var remaining;

    if (!status) {
      return;
    }

    if (message) {
      status.textContent = message;
      status.dataset.tone = tone || "neutral";
      return;
    }

    usedValues = Object.keys(selectedByStat)
      .map(function (key) {
        return selectedByStat[key];
      })
      .filter(function (value) {
        return value !== null;
      });

    remaining = allowedValues.filter(function (value) {
      return usedValues.indexOf(value) === -1;
    });

    if (remaining.length === 0) {
      status.textContent = "Распределение готово: 4 / 3 / 2 / 1 расставлены.";
      status.dataset.tone = "ok";
      return;
    }

    status.textContent = "Свободные значения: " + remaining.join(", ") + ".";
    status.dataset.tone = "neutral";
  }

  function updateHitsVisual() {
    var hits = getHitsValue();

    if (!hpPanel || !hpValue || !hpRank || !hpImage) {
      return;
    }

    hpImage.src = getHitsImage(hits);

    if (hits === null) {
      hpValue.textContent = "Грот знает скока у тебя";
      hpRank.textContent = "Выбери сперва СИЛИЩУ";
      hpPanel.dataset.tier = "unknown";
    } else {
      hpValue.textContent = String(hits);
      hpRank.textContent = getHitsRank(hits);
      hpPanel.dataset.tier = String(hits);
    }

  }

  function updateRowVisual(row) {
    var key;
    var selectedValue;
    var dots;

    if (!row) {
      return;
    }

    key = row.dataset.stat;
    selectedValue = selectedByStat[key];
    dots = row.querySelectorAll(".stat-dot");

    dots.forEach(function (dot) {
      var value = Number(dot.dataset.value);
      var isFilled = selectedValue !== null && value <= selectedValue;
      var blockedOwner = findOwnerOfValue(value, key);
      var isBlocked = value <= maxStarterValue && blockedOwner && selectedValue !== value && !isFilled;
      var isOvercap = value > maxStarterValue;

      dot.classList.toggle("is-filled", isFilled);
      dot.classList.toggle("is-blocked", !!isBlocked);
      dot.classList.toggle("is-overcap", isOvercap);
    });
  }

  function updateAllRows() {
    if (!list) {
      return;
    }

    list.querySelectorAll(".stat-row").forEach(function (row) {
      updateRowVisual(row);
    });
  }

  function handleDotClick(dot) {
    var row;
    var statKey;
    var statLabel;
    var selectedValue;
    var owner;

    if (!dot) {
      return;
    }

    row = dot.closest(".stat-row");
    if (!row) {
      return;
    }

    statKey = row.dataset.stat;
    statLabel = getLabelByKey(statKey);
    selectedValue = Number(dot.dataset.value);

    if (selectedValue > maxStarterValue) {
      updateStatus("На старте доступны только значения 1-4. Точки 5-7 пока запасные.", "warn");
      return;
    }

    owner = findOwnerOfValue(selectedValue, statKey);
    if (owner && selectedByStat[statKey] !== selectedValue) {
      updateStatus(
        selectedValue + " уже занято в строке " + owner.label + ". Для этой характеристики выбери другое.",
        "warn"
      );
      return;
    }

    if (selectedByStat[statKey] === selectedValue) {
      selectedByStat[statKey] = null;
      updateStatus(statLabel + ": значение снято.", "neutral");
    } else {
      selectedByStat[statKey] = selectedValue;
      updateStatus(statLabel + ": поставлено " + selectedValue + ".", "neutral");
    }

    updateAllRows();
    updateHitsVisual();
    saveStatsState();
    updateStatus();
  }

  function bootstrap() {
    if (!list) {
      return;
    }

    renderRows();
    restoreStatsState();
    updateAllRows();
    updateHitsVisual();
    updateStatus();

    list.addEventListener("click", function (event) {
      var dot = event.target.closest(".stat-dot");
      handleDotClick(dot);
    });
  }

  bootstrap();
}());
