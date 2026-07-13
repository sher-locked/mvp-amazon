import type { ListingRef } from '../../domain/listing';
import type { ScrapedPage } from '../../scraping/scraper';
import { countryForMarketplace } from '../../scraping/amazon/country';
import { isBlocked } from '../../scraping/amazon/block-detect';
import type { RawArtifactMeta } from '../../persistence/artifacts/artifact-store';
import type { PipelineContext } from '../context';

export interface ScrapeResult {
  page: ScrapedPage;
  meta: RawArtifactMeta;
}

export interface ScrapeStageOptions {
  /** override the marketplace-derived egress country */
  country?: string;
}

/** Fetch the raw PDP HTML via the context's scraper and persist it. */
export async function scrape(
  ref: ListingRef,
  ctx: PipelineContext,
  opts: ScrapeStageOptions = {},
): Promise<ScrapeResult> {
  const country = opts.country ?? countryForMarketplace(ref.marketplace);
  const started = Date.now();
  const page = await ctx.scraper.fetch(ref.url, { country });
  const durationMs = Date.now() - started;
  const block = isBlocked(page.html);

  const meta: RawArtifactMeta = {
    scraper: ctx.scraper.kind,
    status: page.status,
    country,
    url: page.url,
    fetchedAt: new Date().toISOString(),
    blocked: block.blocked,
    ...(block.marker ? { blockMarker: block.marker } : {}),
    durationMs,
  };

  await ctx.artifacts.saveRaw(ref, page.html, meta);
  ctx.logger.info(
    { asin: ref.asin, marketplace: ref.marketplace, scraper: meta.scraper, blocked: meta.blocked },
    'scraped pdp',
  );
  return { page, meta };
}
