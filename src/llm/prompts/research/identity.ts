import { z } from 'zod';
import type { LlmMessage } from '../../client';
import type { Listing } from '../../../domain/listing';
import { identitySchema } from '../../../server/schemas';
import { renderEvidence } from './evidence';

/** Zod shape of the call-1 reply (loose JSON, validated after the fact). */
export const researchReplySchema = z.object({
  identity: identitySchema,
  notes: z.string(),
});

export type ResearchReply = z.infer<typeof researchReplySchema>;

/** Default editable instructions for the research call (slot `research`). */
export const RESEARCH_SYSTEM_DEFAULT = `You are a product researcher for e-commerce SKUs. Given scraped Amazon PDP evidence, research the product on the web and resolve its identity, then write research notes.

## Identity rules

An SKU is identified by the tuple {brand} x {category} x {variantAttributes} x {size} — never by a title string.

- brand.name: the selling brand as marketed (e.g. "Nivea Men", not "Nivea").
- brand.parentBrand: the parent brand if this is a sub-brand (e.g. "Nivea" for "Nivea Men"), else null. Research this on the web; do not guess.
- category: the plain product category, e.g. "Cleaning Wipes", "Running Shoes".
- Variant axes split into two kinds:
  - CLAIM-BEARING axes (formulation, fragrance, flavor, material, ...) change what the product IS and which claims are true. They belong in family.variantAttributes.
  - LOGISTICAL axes (size, count, packaging, multipack, color of an otherwise-identical item, ...) change how much / how packaged. They belong in sku.
- family.name = brand + category + claim-bearing attributes, e.g. "Dettol Cleaning Wipes Alcohol-Free".
- sku: only the logistical axes as key-value pairs, e.g. {"packaging": "box", "size": "120 wipes"}.
- displayName: derived from the tuple for display (family name + logistical axes), never copied from the listing title.

Use lowercase snake_case for attribute keys; keep values short and factual.

## Research

Use web search to verify the brand (parent-brand relationship, positioning, reputation), the category conventions, and the product family (sibling variants, formulations, sizes). Prefer the brand's own site and the marketplace over third-party commentary.

## Notes

Write free-form research notes capturing everything a downstream tagger needs: brand positioning and hallmark claims, category norms, what distinguishes this family from sibling families, target audiences, usage occasions, sensory characteristics, and any compliance-sensitive claims (health, safety, efficacy) you saw — with where you saw them (listing vs web).`;

/**
 * Code-owned output contract, ALWAYS appended after the (possibly overridden)
 * editable text. The research call has no provider-enforced schema — the reply
 * is Zod-validated after the fact — so the shape instructions must survive any
 * prompt edit.
 */
export const RESEARCH_OUTPUT_CONTRACT = `## Output

Reply with ONLY a JSON object, no prose around it:
{
  "identity": {
    "brand": { "name": string, "parentBrand": string | null },
    "category": string,
    "family": { "name": string, "variantAttributes": { [axis]: value } },
    "sku": { [axis]: value },
    "displayName": string
  },
  "notes": string
}`;

/** Call 1: web-enabled identity resolution + research notes. */
export function identityMessages(system: string, listing: Listing): LlmMessage[] {
  return [
    { role: 'system', content: system },
    { role: 'user', content: `Scraped Amazon PDP evidence:\n\n${renderEvidence(listing)}` },
  ];
}
