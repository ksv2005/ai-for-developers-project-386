import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const { port, host, staticDir } = loadConfig();
const app = buildApp({ staticDir });

try {
  await app.listen({ port, host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
