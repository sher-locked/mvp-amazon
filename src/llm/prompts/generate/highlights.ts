import type { LlmMessage } from '../../client';
import { textJsonSchema } from './output';

export const HIGHLIGHTS_JSON_SCHEMA = textJsonSchema('item_highlights');

const SYSTEM = `You are generating the Amazon Item Highlights field (new field, effective 27 July 2026).

HARD LIMIT: 125 characters including spaces. Target 118 to 125.

PURPOSE
This field is also used to prime voice assistants such as Alexa and AI answer engines. It must pack BOTH the search keywords a shopper types AND the natural-language intent cues a person speaks, inside 125 characters. It is not a plain keyword dump.

WHAT GOES HERE
Semicolon-separated fragments, each carrying a keyword and, where it fits, an intent modifier: what it is, where and when it is used, who it is for, and the key spec. Draw from the tags that did not make the title: the primary benefit or regulated claim, secondary specs, scent (sensory), use-surfaces, occasion, packaging, and any audience term not already used.

RULES
- Do not repeat elements already in the generated title.
- complianceSensitive tags appear only using wording that mirrors the observed page text.
- State as fact only tags at confidence 0.8 or above. An inferred audience term may be implied as framing (for example "for homes with kids"), never stated as a safety claim.
- Spell out "and". Use numerals with a space before units. No emojis, no promotional phrases, no special characters, no em dashes.
- Fill toward 125 using real tags only.

OUTPUT
Return JSON: { "text": the field, "rationale": one short paragraph: which tags were placed here and any dropped on compliance or confidence grounds }.`;

export function highlightsMessages(input: string, title: string): LlmMessage[] {
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: [
        `INPUT (one product object with identity, tags, and the current scraped listing):\n${input}`,
        `TITLE ALREADY GENERATED (do not repeat its elements):\n${title}`,
      ].join('\n\n'),
    },
  ];
}
