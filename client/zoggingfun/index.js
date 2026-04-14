(function () {
  var STORAGE_KEY = "zoggingfun.character.v1";
  var d66Keys = [];
  var tens;
  var ones;

  for (tens = 1; tens <= 6; tens += 1) {
    for (ones = 1; ones <= 6; ones += 1) {
      d66Keys.push(String(tens) + String(ones));
    }
  }

  function buildTable(values) {
    if (values.length !== d66Keys.length) {
      throw new Error("Каждая d66-таблица должна содержать 36 вариантов.");
    }

    return d66Keys.reduce(function (result, key, index) {
      result[key] = values[index];
      return result;
    }, {});
  }

  var tables = {
    name: buildTable([
      "Горбаг", "Наздрак", "Угскар", "Рагзуб", "Дрынгут", "Могрук",
      "Задгоб", "Бурдаг", "Хрумгаш", "Топзог", "Кривдаг", "Шрамдак",
      "Грызмог", "Варбуз", "Скальгут", "Рыкноб", "Бигрук", "Дакказуб",
      "Трогморд", "Бузгац", "Хряскул", "Ржавгоб", "Жардак", "Ломхар",
      "Мясгоб", "Угрот", "Зубшак", "Мордраг", "Шкваргут", "Ургаш",
      "Газдур", "Сквигдур", "Бумзог", "Тракчав", "Грязжуб", "Рёвоноб"
    ]),
    nickname: buildTable([
      "Рваное Ухо", "Два Жуба", "Кривая Рожа", "Косой Глаз", "Бум-Палец", "Громкий", 
      "Соплежуй", "Железный Лоб", "Сквигoдав", "Три Шрама", "Кусок Грота", "Зогнутый", 
      "Красная Нога", "Хряп-Пасть", "Клешнерук", "Без Шеи", "Гнилой Жуб", "Тихий", 
      "Бронелоб", "Синий Череп", "Грязный Топор", "Костехруст", "Вонючий", "Шмаляльщик", 
      "Пальцегрыз", "Сапогoдав", "Глотка-Медь", "Пол-Бошки", "Дырявый", "Шестипалый", 
      "Чёрный Нос", "Ржавая Пасть", "Мордобой", "Хламник", "Жареный", "Не-Этот" 
    ]),
    origin: buildTable([
      "из Красной Пыли","с Лутаной Скалы","из Вонючей Ямы","с Битой Луны","из Грибной Дыры","с Чёрнай Канавы",
      "из Лязгающих Холмов","с Кривого Тракка","из Пепельной Кучи","с Жубастой Пустоши","из Железной Норы","с Варпнутой Тропы",
      "из Ржавых Громил","с Дымящей Кочки","из Лютой Жижи","с Ржавой Баржи","из Треснутой Скалы","с Большой Кучи",
      "из Чёрных Крушил","из Красных Врезал","Любимчик Босса","Бывший Гротогон","из Диких Разваливал","из Костяных Трещал",
      "из Железных Ухмылял","из Безмозглых","из Самых Громких","Последний Выживший","из Гнилых Раздолбал","Племянник Тралла",
      "Который Вернулся","Который Не Сдох","Который Всё Спёр","Который Первый Влетел","Который Жрёт Патроны","Который Последний"
    ])
  };

  var indexByCode = d66Keys.reduce(function (result, code, index) {
    result[code] = index;
    return result;
  }, {});

  var selectedValues = {
    name: null,
    nickname: null,
    origin: null
  };

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

  function saveIdentityState() {
    writeCharacterState(function (state) {
      state.identity = {
        name: selectedValues.name,
        nickname: selectedValues.nickname,
        origin: selectedValues.origin
      };
      return state;
    });
  }

  function findCodeByValue(kind, value) {
    var code;
    var table = tables[kind];

    if (!table || !value) {
      return null;
    }

    for (code in table) {
      if (Object.prototype.hasOwnProperty.call(table, code) && table[code] === value) {
        return code;
      }
    }

    return null;
  }

  function restoreIdentityState() {
    var saved = readCharacterState();
    var identity = saved.identity || {};
    var kinds = ["name", "nickname", "origin"];

    kinds.forEach(function (kind) {
      var value = identity[kind];
      var rollView = document.querySelector("[data-roll=\"" + kind + "\"]");
      var code;

      if (!value || !tables[kind]) {
        return;
      }

      selectedValues[kind] = value;
      code = findCodeByValue(kind, value);

      if (code) {
        if (rollView) {
          rollView.textContent = code;
        }
        renderReel(kind, code);
      }
    });
  }

  function rollD66() {
    var d6Tens = Math.floor(Math.random() * 6) + 1;
    var d6Ones = Math.floor(Math.random() * 6) + 1;
    return String(d6Tens) + String(d6Ones);
  }

  function setLaneContent(reel, laneName, code, text) {
    var lane = reel.querySelector("[data-slot=\"" + laneName + "\"]");
    if (!lane) {
      return;
    }

    lane.innerHTML = "<span class=\"slot-code\">" + code + "</span><span class=\"slot-text\">" + text + "</span>";
  }

  function renderReel(kind, code) {
    var reel = document.querySelector("[data-reel=\"" + kind + "\"]");
    var table = tables[kind];
    var currentIndex;
    var prevCode;
    var nextCode;

    if (!reel || !table || typeof indexByCode[code] === "undefined") {
      return;
    }

    currentIndex = indexByCode[code];
    prevCode = d66Keys[(currentIndex + d66Keys.length - 1) % d66Keys.length];
    nextCode = d66Keys[(currentIndex + 1) % d66Keys.length];

    setLaneContent(reel, "prev", prevCode, table[prevCode]);
    setLaneContent(reel, "current", code, table[code]);
    setLaneContent(reel, "next", nextCode, table[nextCode]);
  }

  function updateFullName() {
    var fullNameView = document.getElementById("full-name");
    var name = selectedValues.name || "Как звать";
    var nickname = selectedValues.nickname || "Кликуха";
    var origin = selectedValues.origin || "Откуда";

    if (!fullNameView) {
      return;
    }

    fullNameView.textContent = name + " \"" + nickname + "\", " + origin;
  }

  function spin(kind, reel) {
    if (reel.dataset.rolling === "true") {
      return;
    }

    var rollView = document.querySelector("[data-roll=\"" + kind + "\"]");
    var table = tables[kind];

    if (!rollView || !reel || !table) {
      return;
    }

    reel.dataset.rolling = "true";
    reel.classList.add("is-rolling");
    reel.setAttribute("aria-busy", "true");

    var tick = 0;
    var totalTicks = 18 + Math.floor(Math.random() * 8);
    var timer = setInterval(function () {
      tick += 1;
      var rollingCode = rollD66();
      rollView.textContent = rollingCode;
      renderReel(kind, rollingCode);

      if (tick >= totalTicks) {
        clearInterval(timer);
        var finalCode = rollD66();
        rollView.textContent = finalCode;
        renderReel(kind, finalCode);
        selectedValues[kind] = table[finalCode];
        updateFullName();
        saveIdentityState();

        reel.dataset.rolling = "false";
        reel.classList.remove("is-rolling");
        reel.setAttribute("aria-busy", "false");
      }
    }, 72);
  }

  document.querySelectorAll(".mini-reel").forEach(function (reel) {
    reel.addEventListener("click", function () {
      spin(reel.dataset.reel, reel);
    });

    reel.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        spin(reel.dataset.reel, reel);
      }
    });
  });

  restoreIdentityState();
  updateFullName();
}());
