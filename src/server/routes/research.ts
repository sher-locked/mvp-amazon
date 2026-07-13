import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container';
import { NotFoundError } from '../../lib/errors';
import type { SkuResearch } from '../../domain/research';
import type { ListingRef } from '../../domain/listing';
import { getResearchQuery, researchBody } from '../schemas';
import { ingest } from '../../pipeline/stages/ingest';
import { research } from '../../pipeline/stages/research';
import { resolveListing } from '../resolve-listing';

const researchResponse = (ref: ListingRef, r: SkuResearch) => ({
  ref,
  identity: r.identity,
  notes: r.notes,
  sources: r.sources,
  researchedAt: r.researchedAt,
  promptVersion: r.promptVersion ?? null,
  sourceParsedAt: r.sourceParsedAt ?? null,
  usage: r.usage ?? null,
  durationMs: r.durationMs ?? null,
});

/**
 * Composable step: url/asin → SkuResearch (identity tuple + research notes +
 * sources). POST runs the web-enabled LLM call (~1 min, real cost); result
 * persisted under tmp/research. GET is a pure read of the latest stored one.
 */
export function registerResearchRoutes(app: FastifyInstance, c: Container): void {
  app.post('/research', async (req, reply) => {
    const { input } = researchBody.parse(req.body);

    const ref = ingest(input);
    const listing = await resolveListing(ref, c.ctx);
    const result = await research(listing, c.ctx);

    return reply.send(researchResponse(ref, result));
  });

  // read-only view of the latest stored research — no LLM, no scraping
  app.get('/research', async (req, reply) => {
    const { input } = getResearchQuery.parse(req.query);

    const ref = ingest(input);
    const stored = await c.ctx.artifacts.loadResearch(ref);
    if (!stored) {
      throw new NotFoundError(
        `no stored research for ${ref.marketplace}_${ref.asin}; run POST /research first`,
      );
    }

    return reply.send(researchResponse(ref, stored));
  });
}
