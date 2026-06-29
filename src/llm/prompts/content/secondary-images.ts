import type { LlmMessage } from '../../client';
import type { Listing } from '../../../domain/listing';
import type { SourceOfTruth } from '../../../domain/research';

/** Rubric prompt for secondary/gallery images. Phase 4 adds vision input. */
export function secondaryImagesPrompt(listing: Listing, _sot: SourceOfTruth): LlmMessage[] {
  return [
    {
      role: 'system',
      content:
        'You evaluate Amazon secondary images for coverage of features, benefits, lifestyle, and infographics. Score 0-100 and list findings.',
    },
    {
      role: 'user',
      content: `Secondary images:\n${listing.secondaryImages.map((i) => i.url).join('\n')}`,
    },
  ];
}
