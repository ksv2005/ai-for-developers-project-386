# Календарь звонков

[![hexlet-check](https://github.com/ksv2005/ai-for-developers-project-386/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/ksv2005/ai-for-developers-project-386/actions)

Разработайте совместно с ИИ сервис для бронирования календаря

Учебный проект Хекслета: https://ru.hexlet.io/programs/ai-for-developers
Как это должно работать: https://files.hexlet.app/a/2ipc5m

## Стек

- Разное

## Установка

<!-- Опишите установку: клонирование, зависимости, переменные окружения -->

```bash
git clone https://github.com/ksv2005/ai-for-developers-project-386.git
cd ai-for-developers-project-386
```

## Конфигурация

- `OWNER_TZ` — часовой пояс Владельца (IANA), по умолчанию `Europe/Moscow`; в нём считаются Рабочее окно (09:00–18:00) и даты.
- `OWNER_NAME` — имя Владельца, отдаётся в `GET /api/owner`; по умолчанию `Владелец`.
- Данные хранятся в памяти и теряются при перезапуске ([ADR-0001](docs/adr/0001-in-memory-storage.md)).
- Авторизации нет по ТЗ: админские эндпоинты (`/api/event-types` для записи, `/api/admin/bookings`) доступны любому, кто знает URL.

## Генерация из контракта

Источник правды об API — TypeSpec-контракт `packages/contract/main.tsp`. Цепочка: TypeSpec → `packages/contract/openapi.yaml` → `packages/api-client/src/schema.d.ts` (типы SDK). Сервер читает `openapi.yaml` в рантайме (fastify-openapi-glue), отдельных серверных файлов нет.

- `pnpm generate` — пересобирает все артефакты одной командой; после правки `main.tsp` запускайте её и коммитьте результат.
- `pnpm generate:check` — `generate` + `git diff --exit-code` по сгенерированным файлам; запускается в CI перед `pnpm check` и падает, если артефакты устарели.
- Сгенерированные файлы коммитятся; в Docker-сборке `pnpm generate` не запускается.

## Использование

<!-- Добавьте примеры запуска и запись asciinema — именно это смотрит работодатель -->

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.
