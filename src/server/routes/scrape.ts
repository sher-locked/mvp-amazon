import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container';
import { scrapeBody, scrapeQuery } from '../schemas';
import { ingest } from '../../pipeline/stages/ingest';
import { scrape } from '../../pipeline/stages/scrape';

/**
 * Composable step: url/asin → raw PDP HTML (persisted). Returns provenance
 * only by default; pass `?include=html` for the multi-MB body.
 */
export function registerScrapeRoutes(app: FastifyInstance, c: Container): void {
  app.post('/scrape', async (req, reply) => {
    const { input, scraper: kind, country } = scrapeBody.parse(req.body);
    const { include } = scrapeQuery.parse(req.query);

    const ref = ingest(input);
    const scraper = c.getScraper(kind);
    const ctx = { ...c.ctx, scraper };
    const { page, meta } = await scrape(ref, ctx, { country });

    return reply.send({
      ref,
      meta,
      blocked: meta.blocked,
      ...(include === 'html' ? { html: page.html } : {}),
    });
  });
}
