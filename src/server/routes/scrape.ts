import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container';
import { scrapeBody } from '../schemas';
import { ingest } from '../../pipeline/stages/ingest';
import { scrape } from '../../pipeline/stages/scrape';

/** Composable step: url/asin → Listing (the 4 parts we evaluate). */
export function registerScrapeRoutes(app: FastifyInstance, c: Container): void {
  app.post('/scrape', async (req, reply) => {
    const { input } = scrapeBody.parse(req.body);
    const ref = ingest(input);
    const listing = await scrape(ref, c.ctx);
    return reply.send({ listing });
  });
}
