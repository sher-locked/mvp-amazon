import { now } from '../../lib/result';
import type { Listing, ListingRef } from '../../domain/listing';
import type { ScrapedPage } from '../../scraping/scraper';
import { parsePdp } from '../../scraping/amazon/pdp-parser';
import type { PipelineContext } from '../context';

export interface ParseStageOptions {
  /** fetchedAt of the scrape that produced `page` — recorded as chain provenance */
  fetchedAt?: string;
}

/** Turn raw PDP HTML into a structured Listing and persist it. */
export async function parse(
  ref: ListingRef,
  page: ScrapedPage,
  ctx: PipelineContext,
  opts: ParseStageOptions = {},
): Promise<Listing> {
  const listing: Listing = {
    ...parsePdp(ref, page),
    parsedAt: now(),
    ...(opts.fetchedAt ? { sourceFetchedAt: opts.fetchedAt } : {}),
  };
  await ctx.artifacts.saveListing(ref, listing);
  ctx.logger.info(
    { asin: ref.asin, marketplace: ref.marketplace, title: listing.title.slice(0, 60) },
    'parsed pdp',
  );
  return listing;
}
