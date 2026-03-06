# Knowledge CRUD + MongoDB

Документ синхронизирован с `README.md` и описывает текущую реализацию API знаний.

## 1. Запуск MongoDB

```bash
npm run db:up
```

MongoDB поднимается в Docker и доступна на `127.0.0.1:27017`.

## 2. Переменные окружения

Создайте `.env` на основе `.env.example`:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DBNAME=necropunk
```

## 3. Запуск сервера

```bash
npm start
```

При старте сервер:
- подключается к MongoDB;
- создаёт индексы для коллекции `knowledge`;
- если коллекция пустая, загружает начальные данные из `server/data/knowledge.json`.

## 4. Пересид коллекции знаний

```bash
npm run seed:knowledge
```

Скрипт очищает коллекцию `knowledge` и заново загружает seed-данные.

## 5. Эндпоинты API

### Группированный формат (для фронтенда)

- `GET /api/knowledge`  
  Возвращает объект вида `{ player: [...], gm: [...] }`.
- `GET /api/knowledge?section=player&q=...&tag=...`  
  Возвращает только выбранную секцию, с фильтрацией.

Поддерживаемые query-параметры:
- `section`: `player` или `gm`
- `q`: поиск по `title`, `available`, `description`, `tags`
- `tag`: можно передавать несколько раз (`?tag=a&tag=b`)
- `tags`: альтернативно CSV-формат (`?tags=a,b`)

### CRUD-формат (плоский список)

- `GET /api/knowledge/items?section=player&q=...&tag=a&tag=b&limit=50&offset=0`
- `GET /api/knowledge/items/:id`
- `POST /api/knowledge/items`
- `PUT /api/knowledge/items/:id`
- `PATCH /api/knowledge/items/:id`
- `DELETE /api/knowledge/items/:id`

`GET /api/knowledge/items` возвращает:

```json
{
  "items": [],
  "total": 0,
  "limit": 50,
  "offset": 0
}
```

## 6. Payload для POST/PUT

```json
{
  "section": "player",
  "title": "Example",
  "available": "All characters",
  "description": "Description",
  "tags": ["tag_bonus"]
}
```

Правила валидации:
- `section`: обязательно, `player` или `gm`
- `title`: обязательно, непустая строка
- `available`, `description`: строки (опционально)
- `tags`: массив строк (опционально)

## 7. Полезные команды

- `npm run db:up` — поднять MongoDB
- `npm run db:down` — остановить и удалить compose-ресурсы
- `npm run db:logs` — смотреть логи MongoDB
- `npm run seed:knowledge` — пересид данных знаний
