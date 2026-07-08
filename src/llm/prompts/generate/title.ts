import type { LlmMessage } from '../../client';
import { textJsonSchema } from './output';

export const TITLE_JSON_SCHEMA = textJsonSchema('listing_title');

const SYSTEM = `You are generating an Amazon product title under the rules effective 27 July 2026.

HARD LIMIT: 75 characters including spaces. Target 70 to 75.

BUILD ORDER
Protected core, always present, in this order:
1. Brand name.
2. Product type: the wording with the most search intent, taken from identity.category and the scraped title.
3. Primary distinguishing attribute: the highest-confidence claim-bearing variantAttribute (family scope, source observed preferred), for example a formulation or flavour.
4. Target user: include here ONLY when the product is defined by who it is for AND the audience tag is source observed at confidence 0.8 or above (for example a drink made specifically for kids). Otherwise skip it here.
5. Size or count: the sku-scope fact.
6. Packaging form: the sku-scope fact (box, pouch, sachet). Merge with size where it reads better, for example "Box of 120".

Optional tail, added only while the running total stays at or under 75, in this priority:
7. One primary benefit: the highest-confidence functional tag, preferring one that is NOT complianceSensitive.
8. A secondary distinguishing attribute.

RULES
- A benefit is never guaranteed a slot. Drop the tail from the bottom up when there is no room. Never drop a protected-core element to fit a benefit.
- If the protected core alone exceeds 75, compress the product-type wording first, then drop packaging, then drop the target user, then shorten the primary attribute. Never drop brand, product type, or size.
- An inferred audience tag never enters the title. Leave it to highlights or description.
- Fill toward 75 using real elements only. Do not pad with filler.
- complianceSensitive tags may appear only using wording that mirrors the observed page text, and only if already the registered claim.
- Use numerals for measurements with a space before the unit. Spell out "and". No emojis, no promotional phrases, no special characters, no em dashes.

OUTPUT
Return JSON: { "text": the title, "rationale": one short paragraph covering what made the tail and what was dropped and why }.`;

export function titleMessages(input: string): LlmMessage[] {
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `INPUT (one product object with identity, tags, and the current scraped listing):\n${input}`,
    },
  ];
}
