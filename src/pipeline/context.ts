import type { Scraper } from '../scraping';
import type { LlmClient } from '../llm';
import type { Logger } from '../lib/logger';

/** Provider handles available to every pipeline stage. */
export interface PipelineContext {
  scraper: Scraper;
  llm: LlmClient;
  logger: Logger;
}
