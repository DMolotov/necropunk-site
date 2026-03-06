# Necropunk Site

Веб-приложение для поддержки TTRPG-сессий по системе NecroPunk.

## Что есть в проекте

- Клиентские страницы (`client/pages`) с интерфейсами игры и справочниками.
- Node.js/Express API (`server`) для статуса, авторизации и знаний.
- MongoDB как основное хранилище данных.
- Полноценный CRUD для раздела знаний (`/api/knowledge`).

## Требования

- Node.js 18+
- npm
- Docker Desktop (для локального MongoDB через `docker compose`)

## Быстрый старт

1. Установите зависимости:

```bash
npm install
```

2. Поднимите MongoDB:

```bash
npm run db:up
```

3. Создайте `.env` на основе `.env.example`:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DBNAME=necropunk
```

4. Запустите сервер:

```bash
npm start
```

Приложение будет доступно на `http://localhost:3000`.

## Работа с данными знаний

При старте сервер:

- подключается к MongoDB;
- создаёт индексы для коллекции `knowledge`;
- если коллекция пустая, заполняет её начальными данными из `server/data/knowledge.json`.

Для принудительного пересида знаний:

```bash
npm run seed:knowledge
```

## Основные npm-скрипты

- `npm start` — запуск сервера
- `npm run dev` — запуск в режиме разработки (nodemon)
- `npm run manage:start` — запуск сервера в фоне
- `npm run manage:stop` — остановка фонового сервера
- `npm run manage:restart` — перезапуск фонового сервера
- `npm run manage:status` — статус фонового сервера
- `npm run db:up` — поднять MongoDB контейнер
- `npm run db:down` — остановить и удалить контейнеры compose
- `npm run db:logs` — логи MongoDB
- `npm run seed:knowledge` — пересид коллекции знаний

## API знаний (Knowledge CRUD)

- `GET /api/knowledge` — знания, сгруппированные по `player` и `gm`
- `GET /api/knowledge?section=player&q=...&tag=...` — сгруппированный ответ с фильтрами
- `GET /api/knowledge/items?section=player&q=...&tag=a&tag=b&limit=50&offset=0` — плоский список с пагинацией
- `GET /api/knowledge/items/:id` — получить запись по id
- `POST /api/knowledge/items` — создать запись
- `PUT /api/knowledge/items/:id` — полная замена записи
- `PATCH /api/knowledge/items/:id` — частичное обновление записи
- `DELETE /api/knowledge/items/:id` — удалить запись

Подробности и пример payload: `docs/knowledge-crud.md`.

## Структура (кратко)

- `client/` — фронтенд страницы и скрипты
- `server/` — API, роуты, библиотека доступа к MongoDB
- `scripts/` — служебные скрипты (manage, seed)
- `docs/` — документация
- `docker-compose.yml` — локальная инфраструктура MongoDB

## Примечание

Если `Docker Desktop` не запущен, команды `db:*` не смогут подключиться к Docker daemon.
