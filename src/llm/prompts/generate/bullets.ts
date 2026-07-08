import type { LlmMessage } from '../../client';
import { BULLETS_JSON_SCHEMA } from './output';

export { BULLETS_JSON_SCHEMA };

const SYSTEM = `You are generating five Amazon About This Item bullets.

LIMITS: 10 to 500 characters per bullet, but the binding target is the mobile budget. Keep all five together under 1,000 characters and fill toward it. Aim about 190 to 200 characters per bullet.

FORMAT
Each bullet is a capitalised keyword head, then a colon, then one plain intent sentence. The head is the keyword a shopper searches (a spec, benefit, or who it is for). The sentence answers when, why, or who.

ROUTING ACROSS THE FIVE
1. Top distinguishing attribute.
2. Primary benefit or functional claim (compliance-aware).
3. Second functional or sensory point (for example multi-surface).
4. Occasion: when and why to use it.
5. Sku facts (size, pack) with an audience note.

RULES
- Do not repeat the exact phrasing of the generated title or item highlights; the bullets expand on them, they do not restate them.
- complianceSensitive claims mirror the observed page text and are not amplified.
- An observed audience tag at confidence 0.8 or above can be a keyword head; an inferred audience tag appears only as soft framing.
- State as fact only tags at confidence 0.8 or above.
- No emojis, no promotional phrases, no special characters, no em dashes.

OUTPUT
Return JSON: { "bullets": array of exactly 5 bullet strings, "rationale": one short paragraph on tag routing and anything dropped }.`;

export function bulletsMessages(input: string, title: string, highlights: string): LlmMessage[] {
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: [
        `INPUT (one product object with identity, tags, and the current scraped listing):\n${input}`,
        `TITLE ALREADY GENERATED (do not repeat its content):\n${title}`,
        `ITEM HIGHLIGHTS ALREADY GENERATED (do not repeat their content):\n${highlights}`,
      ].join('\n\n'),
    },
  ];
}
