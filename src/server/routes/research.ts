import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container';
import { researchBody } from '../schemas';
import { research } from '../../pipeline/stages/research';

/** Composable step: Listing → SourceOfTruth (brand/product/category claims + keywords). */
export function registerResearchRoutes(app: FastifyInstance, c: Container): void {
  app.post('/research', async (req, reply) => {
    const { listing } = researchBody.parse(req.body);
    const sourceOfTruth = await research(listing, c.ctx);
    return reply.send({ sourceOfTruth });
  });
}
