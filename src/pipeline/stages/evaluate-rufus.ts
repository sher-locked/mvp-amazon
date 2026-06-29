import type { Listing } from '../../domain/listing';
import type { SourceOfTruth } from '../../domain/research';
import type { DiscoverabilityResult } from '../../domain/evaluation';
import { probeRufus } from '../../discoverability/rufus';
import type { PipelineContext } from '../context';

export async function evaluateRufus(
  listing: Listing,
  sot: SourceOfTruth,
  ctx: PipelineContext,
): Promise<DiscoverabilityResult> {
  return probeRufus(listing, sot, ctx);
}
