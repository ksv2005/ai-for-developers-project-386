# AGENTS.md

Сервис бронирования звонков (учебный проект Хекслета). Не удаляйте и не переименовывайте `.github/workflows/hexlet-check.yml` и репозиторий.

## Команды

pnpm workspace, запускать из корня (Node >= 24.21, см. `.nvmrc`):

- `pnpm dev` — API (порт 3000) и web (Vite) параллельно; Vite проксирует `/api` на API
- `pnpm check` — все проверки CI: format → lint → typecheck → test → build
- `pnpm test:e2e` — Playwright (`e2e/`) против собранного приложения (`pnpm build` + API со `STATIC_DIR`); не входит в `pnpm check`. Нужен `pnpm --filter e2e exec playwright install chromium`; с `E2E_BASE_URL` бьёт по уже запущенному приложению (так в CI — Docker-образ)
- Один тест: `pnpm vitest run apps/api/src/app.test.ts` (`-t "название"` — фильтр по имени)

## Архитектура

- `apps/api` — Fastify 5; `buildApp()` в `src/app.ts` — фабрика (тесты через `inject`); маршруты под префиксом `/api`; env: `PORT`, `HOST`, `STATIC_DIR`
- `apps/web` — React 19 + Vite
- В Docker один контейнер: при заданном `STATIC_DIR` API раздаёт собранный фронтенд и отдаёт `index.html` для неизвестных GET вне `/api`

## Коммиты

Сообщения коммитов — по спецификации [Conventional Commits](https://www.conventionalcommits.org/): `<тип>[(область)][!]: <описание>`.

- Типы: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- Описание — в повелительном наклонении, строчными буквами, без точки в конце
- Критические изменения: `!` после типа или футер `BREAKING CHANGE:`
- Примеры: `feat: add booking endpoint`, `fix(api): return 404 for unknown routes`

По этим сообщениям release-please генерирует версии и `CHANGELOG.md`.

## Agent skills

### Issue tracker

Issues и specs живут в GitHub Issues (CLI `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Стандартные лейблы: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` + `docs/adr/` в корне. See `docs/agents/domain.md`.
