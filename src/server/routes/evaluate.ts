import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container';
import { evaluateBody } from '../schemas';
import { evaluateContent } from '../../pipeline/stages/evaluate-content';
import { evaluateRufus } from '../../pipeline/stages/evaluate-rufus';
import { evaluateLlmSearch } from '../../pipeline/stages/evaluate-llm-search';

/** Composable steps: the three evaluation axes, each callable on its own. */
export function registerEvaluateRoutes(app: FastifyInstance, c: Container): void {
  app.post('/evaluate/content', async (req, reply) => {
    const { listing, sourceOfTruth } = evaluateBody.parse(req.body);
    const content = await evaluateContent(listing, sourceOfTruth, c.ctx);
    return reply.send({ content });
  });

  app.post('/evaluate/rufus', async (req, reply) => {
    const { listing, sourceOfTruth } = evaluateBody.parse(req.body);
    const rufus = await evaluateRufus(listing, sourceOfTruth, c.ctx);
    return reply.send({ rufus });
  });

  app.post('/evaluate/llm-search', async (req, reply) => {
    const { listing, sourceOfTruth } = evaluateBody.parse(req.body);
    const llmSearch = await evaluateLlmSearch(listing, sourceOfTruth, c.ctx);
    return reply.send({ llmSearch });
  });
}
