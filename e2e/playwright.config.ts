import { defineConfig } from '@playwright/test';

// В CI приложение — собранный Docker-образ, адрес приходит в E2E_BASE_URL.
// Локально поднимаем собранный API, который раздаёт собранный фронтенд.
const externalUrl = process.env.E2E_BASE_URL;
const port = 3100;
const baseURL = externalUrl ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests',
  // Данные в памяти общие для всех тестов, поэтому тесты идут по очереди.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    locale: 'ru-RU',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: externalUrl
    ? undefined
    : {
        command: 'node apps/api/dist/server.js',
        cwd: '..',
        url: `${baseURL}/api/health`,
        // Каждый запуск начинает с пустой памяти.
        reuseExistingServer: false,
        env: {
          PORT: String(port),
          HOST: '127.0.0.1',
          STATIC_DIR: 'apps/web/dist',
        },
      },
});
