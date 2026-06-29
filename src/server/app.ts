import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import type { Container } from '../container';
import { AppError } from '../lib/errors';
import { registerHealthRoutes } from './routes/health';
import { registerRunRoutes } from './routes/runs';
import { registerAuthRoutes } from './routes/auth';
import { registerScrapeRoutes } from './routes/scrape';
import { registerResearchRoutes } from './routes/research';
import { registerEvaluateRoutes } from './routes/evaluate';
import { registerRecommendRoutes } from './routes/recommend';

export function buildApp(c: Container): FastifyInstance {
  const pretty = c.config.NODE_ENV !== 'production';
  const app = Fastify({
    logger: pretty
      ? { level: c.config.LOG_LEVEL, transport: { target: 'pino-pretty' } }
      : { level: c.config.LOG_LEVEL },
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: 'VALIDATION', issues: err.issues });
    }
    if (err instanceof AppError) {
      return reply.code(err.status).send({ error: err.code, message: err.message });
    }
    c.logger.error({ err }, 'unhandled error');
    return reply.code(500).send({ error: 'INTERNAL' });
  });

  registerHealthRoutes(app);
  registerAuthRoutes(app, c);

  // composable step endpoints
  registerScrapeRoutes(app, c);
  registerResearchRoutes(app, c);
  registerEvaluateRoutes(app, c);
  registerRecommendRoutes(app, c);

  // orchestrated pipeline (async)
  registerRunRoutes(app, c);

  return app;
}
