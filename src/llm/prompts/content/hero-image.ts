import type { LlmMessage } from '../../client';
import type { Listing } from '../../../domain/listing';
import type { SourceOfTruth } from '../../../domain/research';

/** Rubric prompt for the hero image. Phase 4 will pass the image to a vision model. */
export function heroImagePrompt(listing: Listing, _sot: SourceOfTruth): LlmMessage[] {
  return [
    {
      role: 'system',
      content:
        'You evaluate an Amazon hero image against Amazon main-image rules (white background, product fill, no text) and click appeal. Score 0-100 and list findings.',
    },
    { role: 'user', content: `Hero image: ${listing.heroImage?.url ?? 'none'}` },
  ];
}
