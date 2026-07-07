import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container';
import { parseBody } from '../schemas';
import { ingest } from '../../pipeline/stages/ingest';
import { scrape } from '../../pipeline/stages/scrape';
import { parse } from '../../pipeline/stages/parse';

/**
 * Composable step: url/asin → structured Listing. Reuses the latest stored
 * raw HTML when available (avoids repeat scrape cost); `refetch: true` or a
 * missing artifact triggers a fresh scrape first.
 */
export function registerParseRoutes(app: FastifyInstance, c: Container): void {
  app.post('/parse', async (req, reply) => {
    const { input, scraper: kind, refetch } = parseBody.parse(req.body);

    const ref = ingest(input);
    const ctx = { ...c.ctx, scraper: c.getScraper(kind) };

    const stored = refetch ? null : await ctx.artifacts.loadRaw(ref);
    const page = stored
      ? { url: stored.meta.url, status: stored.meta.status, html: stored.html }
      : (await scrape(ref, ctx)).page;

    const listing = await parse(ref, page, ctx);
    return reply.send({ listing, source: stored ? 'stored' : 'scraped' });
  });
}
