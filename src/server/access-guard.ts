import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Config } from '../config';
import { AppError } from '../lib/errors';

/** Routes reachable without a key: the UI pages, their assets, and health. */
const PUBLIC_PATHS = new Set([
  '/',
  '/index.html',
  '/prompts.html',
  '/shared.css',
  '/shared.js',
  '/favicon.ico',
  '/health',
]);

function presentedKey(req: FastifyRequest): string | undefined {
  const header = req.headers['x-access-key'];
  if (typeof header === 'string') return header;
  const query = req.query as Record<string, unknown> | null;
  const fromQuery = query?.['key'];
  return typeof fromQuery === 'string' ? fromQuery : undefined;
}

/**
 * Shared-key API guard. No-op when ACCESS_KEY is unset (local dev). When set,
 * every route except the public set requires `x-access-key` (or `?key=`) to
 * match, else 401.
 */
export function registerAccessGuard(app: FastifyInstance, config: Config): void {
  const key = config.ACCESS_KEY;
  if (!key) return;

  app.addHook('onRequest', async (req) => {
    const path = req.url.split('?')[0] ?? req.url;
    if (PUBLIC_PATHS.has(path)) return;
    if (presentedKey(req) !== key) {
      throw new AppError('missing or invalid access key', 401, 'UNAUTHORIZED');
    }
  });
}
