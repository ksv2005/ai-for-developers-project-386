import type { FastifyInstance } from 'fastify';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('GET /api/health', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('responds with status ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('does not serve static files without staticDir', async () => {
    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(404);
  });
});

describe('static files', () => {
  const html = '<!doctype html><title>spa</title>';
  let dir: string;
  let app: FastifyInstance;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'static-'));
    writeFileSync(path.join(dir, 'index.html'), html);
    app = buildApp({ staticDir: dir });
  });

  afterEach(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it.each(['/', '/some/route'])('serves index.html for GET %s', async (url) => {
    const response = await app.inject({ method: 'GET', url });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(html);
  });

  it('still serves the API', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
  });

  it('returns JSON 404 for unknown API paths', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/unknown' });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/json');
  });
});
