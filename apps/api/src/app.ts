import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import path from 'node:path';
import { createInMemoryRepository, type Repository } from './repository.js';
import { routes } from './routes.js';

export interface AppOptions {
  staticDir?: string;
  ownerTz?: string;
  now?: () => Date;
  repository?: Repository;
}

export function buildApp({
  staticDir,
  ownerTz = 'Europe/Moscow',
  now = () => new Date(),
  repository = createInMemoryRepository(),
}: AppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true });

  app.register(routes, { prefix: '/api', repository, ownerTz, now });

  if (staticDir) {
    app.register(fastifyStatic, {
      root: path.resolve(staticDir),
      wildcard: false,
    });

    // SPA fallback: unknown GET paths outside /api get index.html,
    // everything else keeps the default JSON 404.
    app.setNotFoundHandler((request, reply) => {
      const isApi = request.url === '/api' || request.url.startsWith('/api/');
      if (request.method === 'GET' && !isApi) {
        return reply.type('text/html').sendFile('index.html');
      }
      return reply.code(404).send({
        message: `Route ${request.method}:${request.url} not found`,
        error: 'Not Found',
        statusCode: 404,
      });
    });
  }

  return app;
}
