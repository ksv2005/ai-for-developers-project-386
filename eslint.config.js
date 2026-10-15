import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/dist',
    '**/coverage',
    '**/test-results',
    '**/playwright-report',
    'packages/api-client/src/schema.d.ts',
  ]),
  {
    files: ['**/*.{js,ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },
  {
    // The web client talks to the API only through the generated SDK.
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', 'apps/web/src/test/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'Use the api-client SDK instead of calling fetch directly.',
        },
      ],
    },
  },
  eslintConfigPrettier,
]);
