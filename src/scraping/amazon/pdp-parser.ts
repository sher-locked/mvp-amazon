import type { Listing, ListingRef } from '../../domain/listing';
import type { ScrapedPage } from '../scraper';

/**
 * Turn a scraped Amazon PDP into a structured Listing.
 * Phase 0: returns a mock so the pipeline runs end-to-end. Phase 1 replaces
 * this with real DOM/HTML extraction.
 */
export function parsePdp(ref: ListingRef, _page?: ScrapedPage): Listing {
  return {
    ref,
    title: `[mock] product ${ref.asin}`,
    description: '[mock] product description pending real scrape',
    bullets: ['[mock] bullet 1', '[mock] bullet 2'],
    heroImage: { url: '[mock] hero-image-url' },
    secondaryImages: [{ url: '[mock] secondary-1' }, { url: '[mock] secondary-2' }],
  };
}
