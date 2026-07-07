import type { Listing } from '../domain/listing';
import type { TagSet } from '../domain/research';
import type { DiscoverabilityResult } from '../domain/evaluation';
import type { PipelineContext } from '../pipeline/context';

/**
 * Probe Amazon's Rufus shopping agent: is the product searchable, retrievable,
 * and recommended for its target keywords? Phase 2: drive via BrightData
 * Browser API. Phase 0: mock.
 */
export async function probeRufus(
  _listing: Listing,
  _tags: TagSet,
  _ctx: PipelineContext,
): Promise<DiscoverabilityResult> {
  return {
    channel: 'rufus',
    searchable: false,
    retrievable: false,
    recommended: false,
    evidence: ['[mock] rufus probe not yet implemented'],
  };
}
