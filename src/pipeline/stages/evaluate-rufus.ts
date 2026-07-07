import type { Listing } from '../../domain/listing';
import type { TagSet } from '../../domain/research';
import type { DiscoverabilityResult } from '../../domain/evaluation';
import { probeRufus } from '../../discoverability/rufus';
import type { PipelineContext } from '../context';

export async function evaluateRufus(
  listing: Listing,
  tags: TagSet,
  ctx: PipelineContext,
): Promise<DiscoverabilityResult> {
  return probeRufus(listing, tags, ctx);
}
