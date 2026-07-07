import { z } from 'zod';
import type { LlmMessage } from '../../client';
import type { Listing } from '../../../domain/listing';
import type { Identity, SkuResearch, TagSet } from '../../../domain/research';
import { tagSchema } from '../../../server/schemas';
import { renderEvidence } from './evidence';

const TAG_TYPES = ['fact', 'functional', 'sensory', 'emotional', 'occasion', 'audience'] as const;
const TAG_SCOPES = ['brand', 'category', 'family', 'sku'] as const;

/**
 * Strict structured output cannot express open-ended maps
 * (`additionalProperties` must be false), so variantAttributes/sku travel as
 * `{axis, value}` pair arrays and are folded back into records afterwards.
 */
const axisValuePair = {
  type: 'object',
  properties: {
    axis: { type: 'string' },
    value: { type: 'string' },
  },
  required: ['axis', 'value'],
  additionalProperties: false,
};

export const TAG_SET_JSON_SCHEMA = {
  name: 'tag_set',
  schema: {
    type: 'object',
    properties: {
      identity: {
        type: 'object',
        properties: {
          brand: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              parentBrand: { type: ['string', 'null'] },
            },
            required: ['name', 'parentBrand'],
            additionalProperties: false,
          },
          category: { type: 'string' },
          family: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              variantAttributes: { type: 'array', items: axisValuePair },
            },
            required: ['name', 'variantAttributes'],
            additionalProperties: false,
          },
          sku: { type: 'array', items: axisValuePair },
          displayName: { type: 'string' },
        },
        required: ['brand', 'category', 'family', 'sku', 'displayName'],
        additionalProperties: false,
      },
      tags: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            value: { type: 'string' },
            type: { type: 'string', enum: [...TAG_TYPES] },
            scope: { type: 'string', enum: [...TAG_SCOPES] },
            complianceSensitive: { type: 'boolean' },
            source: { type: 'string', enum: ['observed', 'inferred'] },
            evidence: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
          required: [
            'value',
            'type',
            'scope',
            'complianceSensitive',
            'source',
            'evidence',
            'confidence',
          ],
          additionalProperties: false,
        },
      },
    },
    required: ['identity', 'tags'],
    additionalProperties: false,
  } as Record<string, unknown>,
};

const axisPairs = z.array(z.object({ axis: z.string(), value: z.string() }));

/** Wire shape of the call-2 reply (pairs instead of records). */
export const tagsReplySchema = z.object({
  identity: z.object({
    brand: z.object({ name: z.string(), parentBrand: z.string().nullable() }),
    category: z.string(),
    family: z.object({ name: z.string(), variantAttributes: axisPairs }),
    sku: axisPairs,
    displayName: z.string(),
  }),
  tags: z.array(tagSchema),
});

export type TagsReply = z.infer<typeof tagsReplySchema>;

const toRecord = (pairs: { axis: string; value: string }[]): Record<string, string> =>
  Object.fromEntries(pairs.map((p) => [p.axis, p.value]));

export function toTagSet(reply: TagsReply): TagSet {
  const identity: Identity = {
    brand: reply.identity.brand,
    category: reply.identity.category,
    family: {
      name: reply.identity.family.name,
      variantAttributes: toRecord(reply.identity.family.variantAttributes),
    },
    sku: toRecord(reply.identity.sku),
    displayName: reply.identity.displayName,
  };
  return { identity, tags: reply.tags };
}

const SYSTEM = `You are a product-content analyst. Given scraped Amazon PDP evidence plus prior research (identity + notes), produce the product's exhaustive tag set. Every tag sits on two axes: scope and type.

## Types

- fact: objective attribute ("disposable wipe format", "120 wipes")
- functional: what it does ("kills 99.9% germs", "multi-surface cleaning")
- sensory: how it looks/smells/feels ("regular fragrance")
- emotional: how it makes the buyer feel ("trusted hygiene brand")
- occasion: when/where it is used ("quick everyday cleaning", "kitchen")
- audience: who it is for ("families with kids")

## Scopes and the ONE placement rule

Scopes form a chain: brand > category > family > sku. Store each tag EXACTLY ONCE, at the HIGHEST scope where it is true:

- brand: true of everything the brand sells ("trusted hygiene brand")
- category: true of any product in the category, regardless of brand ("disposable wipe format")
- family: true of every size/pack of this product family ("alcohol-free", "multi-surface cleaning")
- sku: true only of this specific size/pack ("120 wipes", "box format")

Never repeat the same tag value at two scopes.

## Flags and provenance

- complianceSensitive: true for regulated/verifiable claims (health, safety, efficacy, "kills 99.9% germs") — it is a flag, not a type.
- source: "observed" when the claim appears in the given evidence; "inferred" when it comes from research or general knowledge.
- evidence: where it came from — use markers like amazon_pdp_title, amazon_pdp_bullet, amazon_pdp_description, amazon_aplus, amazon_pdp_images, llm_research.
- confidence: 0..1.

## Coverage

Be exhaustive: aim to cover all six types where evidence supports them, across all four scopes. Keep tag values short, lowercase, and atomic (one claim per tag). Carry over the identity you are given, correcting it only if the evidence plainly contradicts it.`;

/** Call 2: bucket evidence + research into the flat scope-x-type tag set. */
export function tagsMessages(listing: Listing, research: SkuResearch): LlmMessage[] {
  const user = [
    `Scraped Amazon PDP evidence:\n\n${renderEvidence(listing)}`,
    `Resolved identity:\n${JSON.stringify(research.identity, null, 2)}`,
    `Research notes:\n${research.notes}`,
  ].join('\n\n---\n\n');
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ];
}
