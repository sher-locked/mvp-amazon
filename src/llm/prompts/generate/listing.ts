import { z } from 'zod';
import type { LlmMessage } from '../../client';

/**
 * Single-shot generation: one prompt, one call, all four post-July-2026
 * fields. Character counts are deliberately absent from the output shape —
 * they are computed in code, never trusted from the LLM.
 */

const fieldReply = z.object({ text: z.string(), rationale: z.string() });

export const listingReplySchema = z.object({
  title: fieldReply,
  itemHighlights: fieldReply,
  bullets: z.object({ items: z.array(z.string()), rationale: z.string() }),
  description: fieldReply,
});
export type ListingReply = z.infer<typeof listingReplySchema>;

const FIELD_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    rationale: { type: 'string' },
  },
  required: ['text', 'rationale'],
  additionalProperties: false,
};

export const LISTING_JSON_SCHEMA = {
  name: 'generated_listing',
  schema: {
    type: 'object',
    properties: {
      title: FIELD_SCHEMA,
      itemHighlights: FIELD_SCHEMA,
      bullets: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 5 },
          rationale: { type: 'string' },
        },
        required: ['items', 'rationale'],
        additionalProperties: false,
      },
      description: FIELD_SCHEMA,
    },
    required: ['title', 'itemHighlights', 'bullets', 'description'],
    additionalProperties: false,
  } as Record<string, unknown>,
};

const SYSTEM = `You are generating a complete Amazon product listing under the rules effective 27 July 2026: a Title, an Item Highlights field, five About This Item bullets, and a Product Description.

Generate in order: title, then itemHighlights, then bullets, then description. Later fields must not repeat the phrasing of earlier ones — each layer expands on the previous, it never restates it.

== TITLE ==
HARD LIMIT: 75 characters including spaces. Target 70 to 75.

Build order — protected core, always present, in this order:
1. Brand name.
2. Product type: the wording with the most search intent, taken from identity.category and the scraped title.
3. Primary distinguishing attribute: the highest-confidence claim-bearing variantAttribute (family scope, source observed preferred), for example a formulation or flavour.
4. Target user: include here ONLY when the product is defined by who it is for AND the audience tag is source observed at confidence 0.8 or above (for example a drink made specifically for kids). Otherwise skip it here.
5. Size or count: the sku-scope fact.
6. Packaging form: the sku-scope fact (box, pouch, sachet). Merge with size where it reads better, for example "Box of 120".

Optional tail, added only while the running total stays at or under 75, in this priority:
7. One primary benefit: the highest-confidence functional tag, preferring one that is NOT complianceSensitive.
8. A secondary distinguishing attribute.

Title rules:
- A benefit is never guaranteed a slot. Drop the tail from the bottom up when there is no room. Never drop a protected-core element to fit a benefit.
- If the protected core alone exceeds 75, compress the product-type wording first, then drop packaging, then drop the target user, then shorten the primary attribute. Never drop brand, product type, or size.
- An inferred audience tag never enters the title. Leave it to highlights or description.
- Fill toward 75 using real elements only. Do not pad with filler.

== ITEM HIGHLIGHTS ==
HARD LIMIT: 125 characters including spaces. Target 118 to 125.

Purpose: this field also primes voice assistants such as Alexa and AI answer engines. It must pack BOTH the search keywords a shopper types AND the natural-language intent cues a person speaks, inside 125 characters. It is not a plain keyword dump.

What goes here: semicolon-separated fragments, each carrying a keyword and, where it fits, an intent modifier: what it is, where and when it is used, who it is for, and the key spec. Draw from the tags that did not make the title: the primary benefit or regulated claim, secondary specs, scent (sensory), use-surfaces, occasion, packaging, and any audience term not already used.

Highlights rules:
- Do not repeat elements already placed in the title.
- An inferred audience term may be implied as framing (for example "for homes with kids"), never stated as a safety claim.
- Fill toward 125 using real tags only.

== ABOUT THIS ITEM BULLETS ==
LIMITS: exactly 5 bullets, 10 to 500 characters each, but the binding target is the mobile budget. Keep all five together under 1,000 characters and fill toward it. Aim about 190 to 200 characters per bullet.

Format: each bullet is a capitalised keyword head, then a colon, then one plain intent sentence. The head is the keyword a shopper searches (a spec, benefit, or who it is for). The sentence answers when, why, or who.

Routing across the five:
1. Top distinguishing attribute.
2. Primary benefit or functional claim (compliance-aware).
3. Second functional or sensory point (for example multi-surface).
4. Occasion: when and why to use it.
5. Sku facts (size, pack) with an audience note.

Bullets rules:
- Do not repeat the exact phrasing of the title or item highlights; the bullets expand on them, they do not restate them.
- An observed audience tag at confidence 0.8 or above can be a keyword head; an inferred audience tag appears only as soft framing.

== PRODUCT DESCRIPTION ==
HARD LIMIT: 2,000 characters including spaces and any line breaks. Target 1,900 to 1,990. Fill as close to 2,000 as the real content allows. Do not pad with filler or repeat sentences to reach the count.

Format: plain text. Blank lines may separate paragraphs. No HTML beyond simple line breaks.

Structure (intent-led, keyword phrases folded in naturally):
- Open with the emotional and audience framing: who it is for and why.
- Middle: functional and occasion. What it does, across which surfaces or uses, and when it fits into the day.
- Add the sensory note (scent or feel) if present.
- Close with the facts (size, pack, reseal) and a final sentence that folds in the main phrase a shopper would search.

Description rules:
- Do not repeat the exact phrasing of the title, item highlights, or bullets; the description carries the intent layer in prose, it does not restate them.
- source observed can be stated plainly; source inferred becomes positioning or use-case language, not a hard claim.

== SHARED RULES (all four fields) ==
- complianceSensitive tags may appear only using wording that mirrors the observed page text, and only if already the registered claim; never amplified.
- State as fact only tags at confidence 0.8 or above. Confidence 0.6 to 0.8 may be used only as soft framing.
- Use numerals for measurements with a space before the unit. Spell out "and". No emojis, no promotional phrases, no special characters, no em dashes.

OUTPUT
Return JSON:
{
  "title": { "text": ..., "rationale": one short paragraph covering what made the tail and what was dropped and why },
  "itemHighlights": { "text": ..., "rationale": which tags were placed here and any dropped on compliance or confidence grounds },
  "bullets": { "items": array of exactly 5 bullet strings, "rationale": one short paragraph on tag routing and anything dropped },
  "description": { "text": ..., "rationale": which tags drove which part and anything dropped }
}`;

export function listingMessages(input: string): LlmMessage[] {
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `INPUT (one product object with identity, tags, and the current scraped listing):\n${input}`,
    },
  ];
}
