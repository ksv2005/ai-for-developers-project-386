import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import path from 'node:path';

export interface AppOptions {
  staticDir?: string;
}

export function buildApp({ staticDir }: AppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true });

  app.register(
    async (api) => {
      api.get('/health', async () => ({ status: 'ok' }));
    },
    { prefix: '/api' },
  );

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
