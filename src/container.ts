import type { Config } from './config';
import { createLogger, type Logger } from './lib/logger';
import { createScraper } from './scraping';
import { createLlmClient } from './llm';
import { InMemoryRunRepository } from './persistence/memory/run-repository';
import type { RunRepository } from './persistence/run-repository';
import { JobQueue } from './jobs/queue';
import { StubAuthService, type AuthService } from './auth/service';
import { StubBillingService, type BillingService } from './billing/service';
import type { PipelineContext } from './pipeline/context';

/** Wired application dependencies. Built once at startup. */
export interface Container {
  config: Config;
  logger: Logger;
  repo: RunRepository;
  queue: JobQueue;
  auth: AuthService;
  billing: BillingService;
  ctx: PipelineContext;
}

export function buildContainer(config: Config): Container {
  const logger = createLogger(config.LOG_LEVEL, config.NODE_ENV !== 'production');
  const repo = new InMemoryRunRepository();
  const queue = new JobQueue(logger);
  const scraper = createScraper(config.DEFAULT_SCRAPER, config);
  const llm = createLlmClient(config.DEFAULT_LLM, config);

  return {
    config,
    logger,
    repo,
    queue,
    auth: new StubAuthService(),
    billing: new StubBillingService(),
    ctx: { scraper, llm, logger },
  };
}
