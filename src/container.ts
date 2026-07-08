import { join } from 'node:path';
import type { Config } from './config';
import { createLogger, type Logger } from './lib/logger';
import { createScraperResolver, type ScraperResolver } from './scraping';
import { createLlmClient } from './llm';
import { InMemoryRunRepository } from './persistence/memory/run-repository';
import type { RunRepository } from './persistence/run-repository';
import { FsArtifactStore } from './persistence/artifacts/fs/artifact-store';
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
  /** Resolve a scraper per request; defaults to config.DEFAULT_SCRAPER. */
  getScraper: ScraperResolver;
  ctx: PipelineContext;
}

export function buildContainer(config: Config): Container {
  const logger = createLogger(config.LOG_LEVEL, config.NODE_ENV !== 'production');
  const repo = new InMemoryRunRepository();
  const queue = new JobQueue(logger);
  const getScraper = createScraperResolver(config);
  const llm = createLlmClient(config.DEFAULT_LLM, config);
  const artifacts = new FsArtifactStore(config.ARTIFACTS_DIR ?? join(process.cwd(), 'tmp'));

  return {
    config,
    logger,
    repo,
    queue,
    auth: new StubAuthService(),
    billing: new StubBillingService(),
    getScraper,
    ctx: { scraper: getScraper(), llm, logger, artifacts },
  };
}
