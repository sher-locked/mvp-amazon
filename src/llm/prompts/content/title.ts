import type { LlmMessage } from '../../client';
import type { Listing } from '../../../domain/listing';
import type { SourceOfTruth } from '../../../domain/research';

/** Rubric prompt for evaluating the listing title. Refine in phase 4. */
export function titlePrompt(listing: Listing, _sot: SourceOfTruth): LlmMessage[] {
  return [
    {
      role: 'system',
      content:
        'You evaluate Amazon listing titles against Amazon style guidelines and marketing best practices. Score 0-100 and list concrete findings.',
    },
    { role: 'user', content: `Title:\n${listing.title}` },
  ];
}
