import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container';
import { NotFoundError } from '../../lib/errors';
import { getParseQuery, parseBody } from '../schemas';
import { ingest } from '../../pipeline/stages/ingest';
import { scrape } from '../../pipeline/stages/scrape';
import { parse } from '../../pipeline/stages/parse';

/**
 * Composable step: url/asin → structured Listing. POST reuses the latest
 * stored raw HTML when available (avoids repeat scrape cost); `refetch: true`
 * or a missing artifact triggers a fresh scrape first. GET is a pure read of
 * the latest stored parse — never scrapes, never persists.
 */
export function registerParseRoutes(app: FastifyInstance, c: Container): void {
  app.post('/parse', async (req, reply) => {
    const { input, scraper: kind, refetch } = parseBody.parse(req.body);

    const ref = ingest(input);
    const ctx = { ...c.ctx, scraper: c.getScraper(kind) };

    const stored = refetch ? null : await ctx.artifacts.loadRaw(ref);
    const scraped = stored
      ? { page: { url: stored.meta.url, status: stored.meta.status, html: stored.html }, meta: stored.meta }
      : await scrape(ref, ctx);

    const listing = await parse(ref, scraped.page, ctx, { fetchedAt: scraped.meta.fetchedAt });
    return reply.send({ listing, source: stored ? 'stored' : 'scraped' });
  });

  // read-only view of the latest stored parse — no scraping, no new artifact
  app.get('/parse', async (req, reply) => {
    const { input } = getParseQuery.parse(req.query);

    const ref = ingest(input);
    const listing = await c.ctx.artifacts.loadListing(ref);
    if (!listing) {
      throw new NotFoundError(
        `no stored parse for ${ref.marketplace}_${ref.asin}; run POST /parse first`,
      );
    }

    return reply.send({ ref, listing });
  });
}
