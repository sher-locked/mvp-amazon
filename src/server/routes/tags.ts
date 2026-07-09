import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container';
import { NotFoundError } from '../../lib/errors';
import { getTagsQuery, tagsBody, tagsQuery } from '../schemas';
import { ingest } from '../../pipeline/stages/ingest';
import { research } from '../../pipeline/stages/research';
import { tag } from '../../pipeline/stages/tag';
import { resolveListing } from '../resolve-listing';
import { renderTagMatrix } from '../../research/tag-matrix';

/**
 * Composable step: url/asin → TagSet (identity + flat scope-x-type tags).
 * POST runs the bucketing call, reusing the latest stored research (the
 * expensive web-enabled call) unless `refresh: true` or none exists.
 * GET is a pure read of the latest stored tag set — no LLM involved.
 * `?include=matrix` on either adds a markdown scope-x-type view.
 */
export function registerTagsRoutes(app: FastifyInstance, c: Container): void {
  app.post('/tags', async (req, reply) => {
    const { input, refresh } = tagsBody.parse(req.body);
    const { include } = tagsQuery.parse(req.query);

    const ref = ingest(input);
    const listing = await resolveListing(ref, c.ctx);

    const stored = refresh ? null : await c.ctx.artifacts.loadResearch(ref);
    const skuResearch = stored ?? (await research(listing, c.ctx));

    const tagSet = await tag(listing, skuResearch, c.ctx);

    return reply.send({
      ref,
      identity: tagSet.identity,
      tags: tagSet.tags,
      source: stored ? 'stored' : 'researched',
      promptVersion: tagSet.promptVersion ?? null,
      researchPromptVersion: skuResearch.promptVersion ?? null,
      ...(include === 'matrix' ? { matrix: renderTagMatrix(tagSet) } : {}),
    });
  });

  // read-only view of the latest stored tag set — no LLM, no scraping
  app.get('/tags', async (req, reply) => {
    const { input, include } = getTagsQuery.parse(req.query);

    const ref = ingest(input);
    const tagSet = await c.ctx.artifacts.loadTags(ref);
    if (!tagSet) {
      throw new NotFoundError(
        `no stored tags for ${ref.marketplace}_${ref.asin}; run POST /tags first`,
      );
    }
    const storedResearch = await c.ctx.artifacts.loadResearch(ref);

    return reply.send({
      ref,
      identity: tagSet.identity,
      tags: tagSet.tags,
      promptVersion: tagSet.promptVersion ?? null,
      researchPromptVersion: storedResearch?.promptVersion ?? null,
      ...(include === 'matrix' ? { matrix: renderTagMatrix(tagSet) } : {}),
    });
  });
}
