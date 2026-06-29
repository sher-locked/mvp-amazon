import type { Listing } from '../../domain/listing';
import type { SourceOfTruth } from '../../domain/research';
import { synthesizeSourceOfTruth } from '../../research/synthesizer';
import type { PipelineContext } from '../context';

export async function research(listing: Listing, ctx: PipelineContext): Promise<SourceOfTruth> {
  return synthesizeSourceOfTruth(listing, ctx);
}
