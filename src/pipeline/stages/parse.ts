import type { Listing, ListingRef } from '../../domain/listing';
import type { ScrapedPage } from '../../scraping/scraper';
import { parsePdp } from '../../scraping/amazon/pdp-parser';
import type { PipelineContext } from '../context';

/** Turn raw PDP HTML into a structured Listing and persist it. */
export async function parse(
  ref: ListingRef,
  page: ScrapedPage,
  ctx: PipelineContext,
): Promise<Listing> {
  const listing = parsePdp(ref, page);
  await ctx.artifacts.saveListing(ref, listing);
  ctx.logger.info(
    { asin: ref.asin, marketplace: ref.marketplace, title: listing.title.slice(0, 60) },
    'parsed pdp',
  );
  return listing;
}
