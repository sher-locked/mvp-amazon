import type { Listing } from '../../domain/listing';
import type { TagSet } from '../../domain/research';
import type { DiscoverabilityResult } from '../../domain/evaluation';
import { probeLlmSearch } from '../../discoverability/llm-search';
import type { PipelineContext } from '../context';

export async function evaluateLlmSearch(
  listing: Listing,
  tags: TagSet,
  ctx: PipelineContext,
): Promise<DiscoverabilityResult> {
  return probeLlmSearch(listing, tags, ctx);
}
