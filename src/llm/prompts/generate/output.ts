import { z } from 'zod';

/**
 * Strict output shapes for the four generation calls. Character counts are
 * deliberately absent — they are computed in code, never trusted from the LLM.
 */
export const textReplySchema = z.object({ text: z.string(), rationale: z.string() });
export type TextReply = z.infer<typeof textReplySchema>;

export const bulletsReplySchema = z.object({
  bullets: z.array(z.string()),
  rationale: z.string(),
});
export type BulletsReply = z.infer<typeof bulletsReplySchema>;

export const textJsonSchema = (name: string) => ({
  name,
  schema: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      rationale: { type: 'string' },
    },
    required: ['text', 'rationale'],
    additionalProperties: false,
  } as Record<string, unknown>,
});

export const BULLETS_JSON_SCHEMA = {
  name: 'about_this_item_bullets',
  schema: {
    type: 'object',
    properties: {
      bullets: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 5 },
      rationale: { type: 'string' },
    },
    required: ['bullets', 'rationale'],
    additionalProperties: false,
  } as Record<string, unknown>,
};
