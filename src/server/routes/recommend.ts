import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container';
import { recommendBody } from '../schemas';
import { recommend } from '../../pipeline/stages/recommend';

/** Composable step: Listing + SourceOfTruth + Evaluation → prioritized changes. */
export function registerRecommendRoutes(app: FastifyInstance, c: Container): void {
  app.post('/recommend', async (req, reply) => {
    const { listing, sourceOfTruth, evaluation } = recommendBody.parse(req.body);
    const recommendations = await recommend({ listing, sourceOfTruth, evaluation }, c.ctx);
    return reply.send({ recommendations });
  });
}
