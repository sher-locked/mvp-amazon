import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container';
import { refFromArtifactId } from '../../pipeline/stages/ingest';

/** Refs of every listing with a stored scrape — feeds the UI's known-ASIN picker. */
export function registerListingsRoutes(app: FastifyInstance, c: Container): void {
  app.get('/listings', async (_req, reply) => {
    const ids = await c.ctx.artifacts.listScraped();
    const listings = ids
      .map(refFromArtifactId)
      .filter((ref): ref is NonNullable<typeof ref> => ref !== null);
    return reply.send({ listings });
  });
}
