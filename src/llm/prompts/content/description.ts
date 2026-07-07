import type { LlmMessage } from '../../client';
import type { Listing } from '../../../domain/listing';
import type { TagSet } from '../../../domain/research';

/** Rubric prompt for description + bullets. Refine in phase 4. */
export function descriptionPrompt(listing: Listing, _tags: TagSet): LlmMessage[] {
  return [
    {
      role: 'system',
      content:
        'You evaluate Amazon listing descriptions and bullets for clarity, claim coverage, and conversion. Score 0-100 and list concrete findings.',
    },
    {
      role: 'user',
      content: `Description:\n${listing.description}\n\nBullets:\n${listing.bullets.join('\n')}`,
    },
  ];
}
