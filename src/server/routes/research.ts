import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container';
import { researchBody } from '../schemas';
import { ingest } from '../../pipeline/stages/ingest';
import { research } from '../../pipeline/stages/research';
import { resolveListing } from '../resolve-listing';

/**
 * Composable step: url/asin → SkuResearch (identity tuple + research notes +
 * sources). Web-enabled LLM call; result persisted under tmp/research.
 */
export function registerResearchRoutes(app: FastifyInstance, c: Container): void {
  app.post('/research', async (req, reply) => {
    const { input } = researchBody.parse(req.body);

    const ref = ingest(input);
    const listing = await resolveListing(ref, c.ctx);
    const result = await research(listing, c.ctx);

    return reply.send({
      ref,
      identity: result.identity,
      notes: result.notes,
      sources: result.sources,
    });
  });
}
