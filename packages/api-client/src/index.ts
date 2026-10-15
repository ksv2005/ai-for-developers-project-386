import createClient from 'openapi-fetch';
import type { components, paths } from './schema.js';

export type { components, paths };

export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * Typed client for the contract in packages/contract.
 * `fetch` is resolved at call time so tests can stub the global.
 */
export function createApiClient(baseUrl = globalThis.location?.origin ?? '') {
  return createClient<paths>({
    baseUrl,
    fetch: (request) => globalThis.fetch(request),
  });
}
