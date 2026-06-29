import type { Listing } from '../domain/listing';
import type { SourceOfTruth } from '../domain/research';
import type { PipelineContext } from '../pipeline/context';
import { webSearch } from './web-search';

/**
 * Build a hierarchical source-of-truth (brand/product/category claims + target
 * keywords) from web research + LLM synthesis. Phase 0: mock.
 */
export async function synthesizeSourceOfTruth(
  listing: Listing,
  ctx: PipelineContext,
): Promise<SourceOfTruth> {
  await webSearch(listing.title, ctx);
  return {
    claims: [
      { scope: 'brand', text: '[mock] brand claim', confidence: 0.5 },
      { scope: 'product', text: '[mock] product claim', confidence: 0.5 },
      { scope: 'category', text: '[mock] category claim', confidence: 0.5 },
    ],
    keywords: ['[mock] keyword a', '[mock] keyword b'],
  };
}
