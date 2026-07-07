import type { Listing, ListingRef } from '../domain/listing';
import type { PipelineContext } from '../pipeline/context';
import { scrape } from '../pipeline/stages/scrape';
import { parse } from '../pipeline/stages/parse';
import { listingSchema } from './schemas';

/**
 * Cheapest path to a Listing: latest stored parse artifact, else re-parse the
 * latest stored raw HTML, else scrape fresh. The schema pass backfills fields
 * added since the artifact was stored (e.g. aplusContent).
 */
export async function resolveListing(ref: ListingRef, ctx: PipelineContext): Promise<Listing> {
  const stored = await ctx.artifacts.loadListing(ref);
  if (stored) return listingSchema.parse(stored);

  const raw = await ctx.artifacts.loadRaw(ref);
  const page = raw
    ? { url: raw.meta.url, status: raw.meta.status, html: raw.html }
    : (await scrape(ref, ctx)).page;
  return parse(ref, page, ctx);
}
