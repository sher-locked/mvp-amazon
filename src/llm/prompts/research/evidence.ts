import type { Listing } from '../../../domain/listing';

/** Render the scraped PDP evidence as a flat block both research prompts share. */
export function renderEvidence(listing: Listing): string {
  const { ref } = listing;
  return [
    `ASIN: ${ref.asin} (marketplace: ${ref.marketplace})`,
    `URL: ${ref.url}`,
    `TITLE:\n${listing.title || '(none)'}`,
    `BULLETS:\n${listing.bullets.map((b) => `- ${b}`).join('\n') || '(none)'}`,
    `DESCRIPTION:\n${listing.description || '(none)'}`,
    `A+ CONTENT:\n${listing.aplusContent || '(none)'}`,
    `IMAGES: hero ${listing.heroImage ? 'present' : 'missing'}, ${listing.secondaryImages.length} secondary`,
  ].join('\n\n');
}
