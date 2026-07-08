import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container';
import { NotFoundError } from '../../lib/errors';
import { generateBody, getGenerateQuery } from '../schemas';
import { ingest } from '../../pipeline/stages/ingest';
import { research } from '../../pipeline/stages/research';
import { tag } from '../../pipeline/stages/tag';
import { generate } from '../../pipeline/stages/generate';
import { resolveListing } from '../resolve-listing';

/**
 * Composable step: url/asin → the four post-July-2026 listing fields.
 * POST reuses the latest stored tag set (running the research→tag chain only
 * when missing or `refresh: true`); `only` regenerates a single field into
 * the latest stored generation. GET is a pure read — no LLM involved.
 */
export function registerGenerateRoutes(app: FastifyInstance, c: Container): void {
  app.post('/generate', async (req, reply) => {
    const { input, refresh, only } = generateBody.parse(req.body);

    const ref = ingest(input);

    // fail fast: `only` needs a stored generation — check the cheap pointer
    // before any scraping or LLM work
    const prior = only ? await c.ctx.artifacts.loadGenerated(ref) : undefined;
    if (only && !prior) {
      throw new NotFoundError(
        `no stored generation for ${ref.marketplace}_${ref.asin}; run a full POST /generate first`,
      );
    }

    const listing = await resolveListing(ref, c.ctx);

    const storedTags = refresh ? null : await c.ctx.artifacts.loadTags(ref);
    let tagSet = storedTags;
    if (!tagSet) {
      const storedResearch = refresh ? null : await c.ctx.artifacts.loadResearch(ref);
      const skuResearch = storedResearch ?? (await research(listing, c.ctx));
      tagSet = await tag(listing, skuResearch, c.ctx);
    }

    const generated = await generate(listing, tagSet, c.ctx, {
      ...(only ? { only, prior: prior ?? undefined } : {}),
    });

    return reply.send({ ref, generated, source: storedTags ? 'stored' : 'researched' });
  });

  // read-only view of the latest stored generation — no LLM, no scraping
  app.get('/generate', async (req, reply) => {
    const { input } = getGenerateQuery.parse(req.query);

    const ref = ingest(input);
    const generated = await c.ctx.artifacts.loadGenerated(ref);
    if (!generated) {
      throw new NotFoundError(
        `no stored generation for ${ref.marketplace}_${ref.asin}; run POST /generate first`,
      );
    }

    return reply.send({ ref, generated });
  });
}
