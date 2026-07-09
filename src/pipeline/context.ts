import type { Scraper } from '../scraping';
import type { LlmClient } from '../llm';
import type { Logger } from '../lib/logger';
import type { ArtifactStore } from '../persistence/artifacts/artifact-store';
import type { PromptStore } from '../persistence/prompts/prompt-store';

/** Provider handles available to every pipeline stage. */
export interface PipelineContext {
  scraper: Scraper;
  llm: LlmClient;
  logger: Logger;
  artifacts: ArtifactStore;
  prompts: PromptStore;
}
