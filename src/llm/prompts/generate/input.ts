import type { Listing } from '../../../domain/listing';
import type { Tag, TagSet } from '../../../domain/research';

/**
 * Mechanical §4 gates, enforced in code so the prompts never see tags they
 * must not use: inferred + complianceSensitive is dropped entirely, and
 * confidence below 0.6 is dropped. Soft routing (0.6–0.8 as framing only,
 * scope priority) stays in the prompts.
 */
export function filterTagsForGeneration(tags: Tag[]): Tag[] {
  return tags.filter(
    (t) => !(t.source === 'inferred' && t.complianceSensitive) && t.confidence >= 0.6,
  );
}

/**
 * The §2c input object shared by all four generation prompts. `scraped`
 * includes aplusContent (the doc omits it, but compliance wording that must
 * be mirrored can live there).
 */
export function renderGenerationInput(listing: Listing, tagSet: TagSet): string {
  return JSON.stringify(
    {
      identity: tagSet.identity,
      tags: filterTagsForGeneration(tagSet.tags),
      scraped: {
        title: listing.title,
        bullets: listing.bullets,
        description: listing.description,
        aplusContent: listing.aplusContent,
      },
    },
    null,
    2,
  );
}
