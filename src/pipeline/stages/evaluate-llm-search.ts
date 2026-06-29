import type { Listing } from '../../domain/listing';
import type { SourceOfTruth } from '../../domain/research';
import type { DiscoverabilityResult } from '../../domain/evaluation';
import { probeLlmSearch } from '../../discoverability/llm-search';
import type { PipelineContext } from '../context';

export async function evaluateLlmSearch(
  listing: Listing,
  sot: SourceOfTruth,
  ctx: PipelineContext,
): Promise<DiscoverabilityResult> {
  return probeLlmSearch(listing, sot, ctx);
}
