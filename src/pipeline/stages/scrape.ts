import type { Listing, ListingRef } from '../../domain/listing';
import { parsePdp } from '../../scraping/amazon/pdp-parser';
import type { PipelineContext } from '../context';

/**
 * Fetch + parse the Amazon PDP into a Listing.
 * Phase 0: skip the network and return a mock via parsePdp.
 * Phase 1: `const page = await ctx.scraper.fetch(ref.url); return parsePdp(ref, page);`
 */
export async function scrape(ref: ListingRef, _ctx: PipelineContext): Promise<Listing> {
  return parsePdp(ref);
}
