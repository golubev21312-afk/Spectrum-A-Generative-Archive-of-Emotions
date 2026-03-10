# Spectrum — Generative Archive of Emotions

Каждый день мы чувствуем десятки эмоций, но редко можем их выразить словами. Spectrum превращает чувства в визуальную форму — интерактивный 3D-куб, который меняет цвет, форму, прозрачность и движение в реальном времени. Сохраняйте свои эмоции в общий архив и исследуйте, что чувствуют другие люди.

## Возможности

**Создание и просмотр**
- 5 параметров куба — оттенок, прозрачность, скорость вращения, шум, плотность частиц
- Автоматическое определение типа эмоции по 15 правилам (радость, ярость, меланхолия, хаос и др.)
- Амбиентный звук, подобранный под эмоцию, с кнопкой mute/unmute
- Авто-режим: автоматическая смена случайных эмоций каждые 5 секунд с crossfade
- Клонирование чужой эмоции — открывает создание с теми же параметрами

**Лента и поиск**
- Бесконечный скролл с skeleton-загрузкой
- Сортировка: новые / популярные / трендовые (формула Hacker News)
- Раздел «Сегодня в топе» — топ-5 эмоций за последние 24 часа
- Полнотекстовый поиск по типу эмоции и имени автора (PostgreSQL tsvector + GIN)
- Фильтрация по типу эмоции, лента подписок

**Социальные функции**
- Лайки, комментарии, подписки на авторов
- Уведомления о лайках и комментариях
- Профиль пользователя: bio, экспорт своих эмоций в JSON
- Вкладки подписчиков и подписок на профиле

**Дополнительно**
- Тема оформления light/dark, сохраняется в localStorage
- Акцентный цвет интерфейса меняется под hue открытой эмоции
- OG-теги для шеринга (/share/:id) — og:title, og:description, og:image
- Генеративный аватар пользователя на основе никнейма
- Счётчик просмотров эмоций
- Двуязычный интерфейс (русский / английский)
- Мобильный bottom nav

## Стек

| Слой | Технологии |
|------|-----------|
| Frontend | TypeScript, Three.js, Vite, GLSL-шейдеры, Web Audio API |
| Backend | Python 3.11, FastAPI, asyncpg |
| База данных | PostgreSQL (JSONB, GIN-индексы, tsvector) |
| Миграции | Alembic + psycopg2 |
| Авторизация | JWT (access 15 мин + refresh 30 дней), bcrypt |
| Тесты | pytest + httpx (backend, 25 тестов), vitest (frontend), Playwright (E2E) |

## Установка

### Требования

- Node.js 18+
- Python 3.10+
- PostgreSQL 14+

### Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Linux / Mac
source venv/bin/activate

pip install -r requirements.txt
```

Создайте файл `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/spectrum
JWT_SECRET=your-secret-key
# Опционально:
# CORS_ORIGINS=http://localhost:5173,https://yourdomain.com
# ACCESS_TOKEN_TTL=900
# REFRESH_TOKEN_TTL=2592000
```

Запустите миграции и сервер:

```bash
alembic upgrade head
uvicorn main:app --reload
```

API доступен на `http://localhost:8000`, документация — `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Приложение откроется на `http://localhost:5173`.

## Тесты

```bash
# Backend
cd backend
pytest

# Frontend (vitest)
cd frontend
npm test

# E2E (Playwright) — требует запущенных backend + frontend
cd e2e
npm test
```

## API (основные эндпоинты)

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/register` | Регистрация |
| POST | `/login` | Вход — возвращает access + refresh токены |
| POST | `/refresh` | Обновить access-токен по refresh-токену |
| POST | `/emotions` | Создать эмоцию |
| GET | `/emotions` | Лента (фильтры: sort, emotion_type, q, following, period) |
| GET | `/emotions/:id` | Получить эмоцию (инкремент просмотров) |
| DELETE | `/emotions/:id` | Удалить свою эмоцию |
| PATCH | `/emotions/:id/type` | Изменить тип эмоции |
| POST/DELETE | `/emotions/:id/like` | Лайк / убрать лайк |
| GET | `/emotions/:id/comments` | Комментарии |
| POST | `/emotions/:id/comments` | Добавить комментарий |
| GET | `/share/:id` | HTML-страница с OG-тегами для шеринга |
| GET | `/users/:username` | Профиль пользователя |
| PATCH | `/users/:username/bio` | Обновить bio |
| POST/DELETE | `/users/:username/follow` | Подписаться / отписаться |
| GET | `/users/:username/followers` | Список подписчиков |
| GET | `/users/:username/following` | Список подписок |
| GET | `/notifications` | Уведомления |
| POST | `/notifications/read` | Отметить все прочитанными |
