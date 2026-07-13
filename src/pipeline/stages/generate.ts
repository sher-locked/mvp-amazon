import { AppError } from '../../lib/errors';
import { now } from '../../lib/result';
import type { Listing } from '../../domain/listing';
import type { TagSet } from '../../domain/research';
import type { GeneratedListing } from '../../domain/generation';
import type { LlmUsage } from '../../domain/usage';
import type { LlmMessage } from '../../llm/client';
import { parseJsonReply } from '../../llm/json';
import { renderGenerationInput } from '../../llm/prompts/generate/input';
import {
  LISTING_JSON_SCHEMA,
  listingMessages,
  listingReplySchema,
  type ListingReply,
} from '../../llm/prompts/generate/listing';
import { resolvePrompt } from '../../llm/prompts/registry';
import type { PipelineContext } from '../context';

const TITLE_MAX = 75;
const HIGHLIGHTS_MAX = 125;
const BULLET_MIN = 10;
const BULLET_MAX = 500;
const BULLETS_TOTAL_MAX = 1000;
const DESCRIPTION_MAX = 2000;

function parseReply(raw: unknown): ListingReply {
  const parsed = listingReplySchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(`llm listing reply failed validation: ${parsed.error.message}`, 502, 'LLM');
  }
  return parsed.data;
}

const cutInstruction = (over: number): string =>
  `Cut at least ${over + 10} characters by removing or tightening whole sentences — keep the protected core and the required structure. It is better to land 30 characters under the limit than 1 over.`;

/**
 * Hard limits checked deterministically in code, never trusted from the model.
 * Returns every violation so a single corrective re-prompt can fix them all.
 */
function collectViolations(value: ListingReply): string[] {
  const violations: string[] = [];

  if (value.title.text.length > TITLE_MAX) {
    violations.push(
      `Your title was ${value.title.text.length} characters; the hard limit is ${TITLE_MAX} including spaces. ${cutInstruction(value.title.text.length - TITLE_MAX)}`,
    );
  }
  if (value.itemHighlights.text.length > HIGHLIGHTS_MAX) {
    violations.push(
      `Your item highlights were ${value.itemHighlights.text.length} characters; the hard limit is ${HIGHLIGHTS_MAX} including spaces. ${cutInstruction(value.itemHighlights.text.length - HIGHLIGHTS_MAX)}`,
    );
  }

  const bullets = value.bullets.items;
  if (bullets.length !== 5) {
    violations.push(`You returned ${bullets.length} bullets; exactly 5 are required.`);
  }
  const bad = bullets.find((b) => b.length < BULLET_MIN || b.length > BULLET_MAX);
  if (bad !== undefined) {
    violations.push(
      `One bullet was ${bad.length} characters; each must be ${BULLET_MIN} to ${BULLET_MAX}.`,
    );
  }
  const bulletsTotal = bullets.reduce((n, b) => n + b.length, 0);
  if (bulletsTotal > BULLETS_TOTAL_MAX) {
    violations.push(
      `Your five bullets totalled ${bulletsTotal} characters; the mobile budget is ${BULLETS_TOTAL_MAX} across all five. Compress them while keeping the keyword heads.`,
    );
  }

  if (value.description.text.length > DESCRIPTION_MAX) {
    violations.push(
      `Your description was ${value.description.text.length} characters; the hard limit is ${DESCRIPTION_MAX} including spaces. ${cutInstruction(value.description.text.length - DESCRIPTION_MAX)}`,
    );
  }

  return violations;
}

function toGenerated(value: ListingReply): GeneratedListing {
  return {
    title: {
      text: value.title.text,
      chars: value.title.text.length,
      rationale: value.title.rationale,
    },
    itemHighlights: {
      text: value.itemHighlights.text,
      chars: value.itemHighlights.text.length,
      rationale: value.itemHighlights.rationale,
    },
    bullets: {
      items: value.bullets.items,
      chars: value.bullets.items.reduce((n, b) => n + b.length, 0),
      rationale: value.bullets.rationale,
    },
    description: {
      text: value.description.text,
      chars: value.description.text.length,
      rationale: value.description.rationale,
    },
    generatedAt: now(),
  };
}

/**
 * Generate all four post-July-2026 listing fields from the tag set in ONE
 * schema-strict fast-tier call. Hard limits are validated in code; every
 * violation is collected and fed back in a single corrective re-prompt
 * (which regenerates the whole document). Still violating → 502 LLM.
 * Persists a complete four-field document per version.
 */
export async function generate(
  listing: Listing,
  tags: TagSet,
  ctx: PipelineContext,
): Promise<GeneratedListing> {
  const prompt = await resolvePrompt('generate', ctx.prompts);
  const input = renderGenerationInput(listing, tags);
  const base = listingMessages(prompt.system, input);

  let messages: LlmMessage[] = base;
  let value: ListingReply | undefined;
  let violations: string[] = [];
  let usage: LlmUsage | undefined;
  const started = Date.now();

  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await ctx.llm.complete({ messages, schema: LISTING_JSON_SCHEMA, tier: 'fast' });
    if (reply.usage) {
      usage = usage
        ? {
            model: reply.usage.model,
            inputTokens: usage.inputTokens + reply.usage.inputTokens,
            outputTokens: usage.outputTokens + reply.usage.outputTokens,
          }
        : reply.usage;
    }
    value = parseReply(parseJsonReply(reply.text));
    violations = collectViolations(value);
    if (violations.length === 0) break;
    messages = [
      ...base,
      { role: 'assistant', content: reply.text },
      {
        role: 'user',
        content: `Your reply violated hard limits:\n${violations.map((v) => `- ${v}`).join('\n')}\nRegenerate the full document and return the same JSON shape. Fields not listed above were fine — keep their substance.`,
      },
    ];
  }
  if (!value || violations.length > 0) {
    throw new AppError(
      `listing generation failed after corrective retry: ${violations.join(' | ')}`,
      502,
      'LLM',
    );
  }

  const result: GeneratedListing = {
    ...toGenerated(value),
    promptVersion: prompt.version,
    ...(tags.taggedAt ? { sourceTaggedAt: tags.taggedAt } : {}),
    ...(usage ? { usage } : {}),
    durationMs: Date.now() - started,
  };

  await ctx.artifacts.saveGenerated(listing.ref, result);
  ctx.logger.info(
    {
      asin: listing.ref.asin,
      marketplace: listing.ref.marketplace,
      chars: {
        title: result.title.chars,
        highlights: result.itemHighlights.chars,
        bullets: result.bullets.chars,
        description: result.description.chars,
      },
    },
    'generated listing fields',
  );
  return result;
}
