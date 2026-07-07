import type { Listing } from '../domain/listing';
import type { TagSet } from '../domain/research';
import type { DiscoverabilityResult } from '../domain/evaluation';
import type { PipelineContext } from '../pipeline/context';

/**
 * Probe LLM-based search (ChatGPT / Claude / Perplexity) for the product,
 * ideally via headless web to match what a real shopper sees. Phase 3: real
 * probes. Phase 0: mock.
 */
export async function probeLlmSearch(
  _listing: Listing,
  _tags: TagSet,
  _ctx: PipelineContext,
): Promise<DiscoverabilityResult> {
  return {
    channel: 'llm-search',
    searchable: false,
    retrievable: false,
    recommended: false,
    evidence: ['[mock] llm-search probe not yet implemented'],
  };
}
