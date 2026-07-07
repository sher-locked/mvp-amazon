import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container';
import { recommendBody } from '../schemas';
import { recommend } from '../../pipeline/stages/recommend';

/** Composable step: Listing + TagSet + Evaluation → prioritized changes. */
export function registerRecommendRoutes(app: FastifyInstance, c: Container): void {
  app.post('/recommend', async (req, reply) => {
    const { listing, tags, evaluation } = recommendBody.parse(req.body);
    const recommendations = await recommend({ listing, tags, evaluation }, c.ctx);
    return reply.send({ recommendations });
  });
}
