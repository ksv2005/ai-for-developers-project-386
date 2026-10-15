# Календарь звонков

[![hexlet-check](https://github.com/ksv2005/ai-for-developers-project-386/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/ksv2005/ai-for-developers-project-386/actions)

Разработайте совместно с ИИ сервис для бронирования календаря

Учебный проект Хекслета: https://ru.hexlet.io/programs/ai-for-developers
Как это должно работать: https://files.hexlet.app/a/2ipc5m

## Что это

Сервис бронирования звонков в духе Cal.com: Владелец публикует типы событий, Гости выбирают тип, свободный слот и записываются без регистрации.

**Развёрнутый сервис:** https://call-booking-0n46.onrender.com/

> На бесплатном плане Render первый заход после простоя может занять до минуты — сервис просыпается.

## Сценарии

**Гость**

1. Открывает каталог типов событий (`/book`) и выбирает нужный.
2. Выбирает дату и свободный слот в календаре (`/book/:id`).
3. Заполняет форму с именем и email (`/book/:id/form`).
4. Видит подтверждение брони (`/book/:id/done`). Занятый слот второй раз забронировать нельзя.

**Владелец** (`/admin`)

- Создаёт, редактирует и удаляет типы событий.
- Смотрит список предстоящих бронирований.

## Стек и структура

TypeScript, pnpm workspace, Node >= 24.21 (см. `.nvmrc`).

- `apps/api` — Fastify 5; маршруты под префиксом `/api`, хранилище в памяти.
- `apps/web` — React 19 + Vite.
- `packages/contract` — TypeSpec-контракт и сгенерированный `openapi.yaml`.
- `packages/api-client` — типизированный SDK, сгенерированный из OpenAPI.
- `e2e` — Playwright-тесты против собранного приложения.

## Запуск локально

```bash
pnpm install
pnpm dev
```

API стартует на порту 3000, web (Vite) — рядом; Vite проксирует `/api` на API.

### Docker

В Docker один контейнер: API раздаёт собранный фронтенд и отдаёт `index.html` для неизвестных GET вне `/api`.

```bash
pnpm docker:build
pnpm docker:run   # http://localhost:3000
# или на другом порту
docker run --rm -e PORT=10000 -p 10000:10000 ai-for-developers-project-386:local
```

### Переменные окружения

| Переменная   | По умолчанию    | Описание                                                                                            |
| ------------ | --------------- | --------------------------------------------------------------------------------------------------- |
| `PORT`       | `3000`          | Порт API (Render передаёт свой)                                                                     |
| `HOST`       | `0.0.0.0`       | Адрес, на котором слушает API                                                                       |
| `STATIC_DIR` | не задан        | Каталог собранного фронтенда; если задан, API раздаёт его с SPA-фолбэком (в образе — `/app/public`) |
| `OWNER_TZ`   | `Europe/Moscow` | Часовой пояс Владельца (IANA); в нём считаются Рабочее окно (09:00–18:00) и даты                    |
| `OWNER_NAME` | `Владелец`      | Имя Владельца, отдаётся в `GET /api/owner`                                                          |

## Контракт: TypeSpec → OpenAPI → SDK

Источник правды об API — `packages/contract/main.tsp`. Цепочка: TypeSpec → `packages/contract/openapi.yaml` → `packages/api-client/src/schema.d.ts` (типы SDK). Сервер читает `openapi.yaml` в рантайме (fastify-openapi-glue), отдельных серверных файлов нет.

Порядок изменения контракта:

1. Правим `packages/contract/main.tsp`.
2. Запускаем `pnpm generate` — пересобирает `openapi.yaml` и типы SDK одной командой.
3. Подгоняем `apps/api` и `apps/web` под новые типы.
4. Коммитим сгенерированные файлы вместе с изменением.

`pnpm generate:check` — `generate` + `git diff --exit-code` по сгенерированным файлам; запускается в CI перед `pnpm check` и падает, если артефакты устарели. В Docker-сборке `pnpm generate` не запускается.

## Тесты

- `pnpm check` — все проверки CI: format → lint → typecheck → test (Vitest) → build.
- `pnpm test:e2e` — Playwright против собранного приложения. Один раз нужен `pnpm --filter e2e exec playwright install chromium`. С `E2E_BASE_URL` тесты бьют по уже запущенному приложению.

В CI (`.github/workflows/ci.yml`):

- `check` — `pnpm generate:check` и `pnpm check`;
- `docker` — сборка образа и smoke-тест контейнера;
- `e2e` — Playwright против Docker-образа.

## Деплой на Render

Конфигурация — Blueprint `render.yaml` в корне: один web service, runtime Docker (`Dockerfile` из корня), план free, автодеплой из `main`, health check `/api/health`.

1. В Render: **New → Blueprint**, выберите этот репозиторий.
2. Проверьте переменные `OWNER_TZ` и `OWNER_NAME` (значения по умолчанию заданы в `render.yaml`).
3. После первого деплоя вставьте ссылку на сервис в раздел «Что это».

`PORT` не задаётся: Render передаёт его сам, сервер читает его из окружения.

## Ограничения

- Данные хранятся в памяти и теряются при перезапуске и засыпании бесплатного плана Render ([ADR-0001](docs/adr/0001-in-memory-storage.md)).
- Авторизации нет по ТЗ: админка `/admin` и админские эндпоинты (`/api/event-types` для записи, `/api/admin/bookings`) доступны любому, кто знает URL.

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## Демо

<!-- Добавьте запись asciinema — именно это смотрит работодатель -->

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
