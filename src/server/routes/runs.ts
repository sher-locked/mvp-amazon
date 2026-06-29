import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container';
import { NotFoundError } from '../../lib/errors';
import { newRun } from '../../domain/run';
import { executeRun } from '../../pipeline/orchestrator';

const createRunBody = z.object({
  input: z.string().min(1, 'input (url or ASIN) is required'),
});

const runParams = z.object({ id: z.string().min(1) });

export function registerRunRoutes(app: FastifyInstance, c: Container): void {
  app.post('/runs', async (req, reply) => {
    const { input } = createRunBody.parse(req.body);

    const run = newRun(input);
    await c.repo.create(run);
    c.queue.enqueue(() => executeRun(run.id, { repo: c.repo, ctx: c.ctx }));

    return reply.code(202).send({ runId: run.id, status: run.status });
  });

  app.get('/runs/:id', async (req, reply) => {
    const { id } = runParams.parse(req.params);
    const run = await c.repo.get(id);
    if (!run) throw new NotFoundError(`run ${id}`);
    return reply.send(run);
  });
}
