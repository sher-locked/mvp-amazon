import type { LlmMessage } from '../../client';
import { textJsonSchema } from './output';

export const DESCRIPTION_JSON_SCHEMA = textJsonSchema('product_description');

const SYSTEM = `You are generating the Amazon Product Description.

HARD LIMIT: 2,000 characters including spaces and any line breaks. Target 1,900 to 1,990. Fill as close to 2,000 as the real content allows. Do not pad with filler or repeat sentences to reach the count.

FORMAT: plain text. Blank lines may separate paragraphs. No HTML beyond simple line breaks.

STRUCTURE (intent-led, keyword phrases folded in naturally)
- Open with the emotional and audience framing: who it is for and why.
- Middle: functional and occasion. What it does, across which surfaces or uses, and when it fits into the day.
- Add the sensory note (scent or feel) if present.
- Close with the facts (size, pack, reseal) and a final sentence that folds in the main phrase a shopper would search.

RULES
- Do not repeat the exact phrasing of the generated title, item highlights, or bullets; the description carries the intent layer in prose, it does not restate them.
- source observed can be stated plainly; source inferred becomes positioning or use-case language, not a hard claim.
- complianceSensitive claims mirror the observed page text and are not amplified.
- Confidence 0.6 to 0.8 may be used only as soft framing.
- No emojis, no promotional phrases, no special characters, no em dashes.

OUTPUT
Return JSON: { "text": the description, "rationale": one short paragraph on which tags drove which part and anything dropped }.`;

export function descriptionMessages(
  input: string,
  title: string,
  highlights: string,
  bullets: string[],
): LlmMessage[] {
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: [
        `INPUT (one product object with identity, tags, and the current scraped listing):\n${input}`,
        `TITLE ALREADY GENERATED (do not repeat its content):\n${title}`,
        `ITEM HIGHLIGHTS ALREADY GENERATED (do not repeat their content):\n${highlights}`,
        `BULLETS ALREADY GENERATED (do not repeat their content):\n${bullets.map((b) => `- ${b}`).join('\n')}`,
      ].join('\n\n'),
    },
  ];
}
