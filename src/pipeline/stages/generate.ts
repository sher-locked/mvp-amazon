import { AppError, ValidationError } from '../../lib/errors';
import { now } from '../../lib/result';
import type { Listing } from '../../domain/listing';
import type { TagSet } from '../../domain/research';
import type {
  GeneratedBullets,
  GeneratedField,
  GeneratedFieldName,
  GeneratedListing,
} from '../../domain/generation';
import type { LlmMessage } from '../../llm/client';
import { parseJsonReply } from '../../llm/json';
import { renderGenerationInput } from '../../llm/prompts/generate/input';
import { TITLE_JSON_SCHEMA, titleMessages } from '../../llm/prompts/generate/title';
import { HIGHLIGHTS_JSON_SCHEMA, highlightsMessages } from '../../llm/prompts/generate/highlights';
import { BULLETS_JSON_SCHEMA, bulletsMessages } from '../../llm/prompts/generate/bullets';
import {
  DESCRIPTION_JSON_SCHEMA,
  descriptionMessages,
} from '../../llm/prompts/generate/description';
import { bulletsReplySchema, textReplySchema } from '../../llm/prompts/generate/output';
import type { PipelineContext } from '../context';

export interface GenerateOptions {
  /** regenerate a single field, merging into `prior` */
  only?: GeneratedFieldName;
  /** required with `only`: the stored generation the new field merges into */
  prior?: GeneratedListing;
}

interface JsonSchema {
  name: string;
  schema: Record<string, unknown>;
}

/**
 * One schema-strict fast-tier call with code-side validation and a single
 * corrective re-prompt: hard limits are checked deterministically here, never
 * trusted from the model. Still violating after the retry → 502 LLM.
 */
async function callWithRetry<T>(
  ctx: PipelineContext,
  field: string,
  base: LlmMessage[],
  schema: JsonSchema,
  parse: (raw: unknown) => T,
  violation: (value: T) => string | null,
): Promise<T> {
  let messages = base;
  let lastProblem: string | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await ctx.llm.complete({ messages, schema, tier: 'fast' });
    const value = parse(parseJsonReply(reply.text));
    lastProblem = violation(value);
    if (!lastProblem) return value;
    messages = [
      ...base,
      { role: 'assistant', content: reply.text },
      { role: 'user', content: `${lastProblem} Regenerate and return the same JSON shape.` },
    ];
  }
  throw new AppError(`${field} generation failed after corrective retry: ${lastProblem}`, 502, 'LLM');
}

const parseText = (field: string) => (raw: unknown) => {
  const parsed = textReplySchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(`llm ${field} reply failed validation: ${parsed.error.message}`, 502, 'LLM');
  }
  return parsed.data;
};

const overLimit = (label: string, hard: number) => (value: { text: string }) =>
  value.text.length > hard
    ? `Your ${label} was ${value.text.length} characters; the hard limit is ${hard} including spaces. Cut at least ${value.text.length - hard + 10} characters by removing or tightening whole sentences — keep the protected core and the required structure. It is better to land 30 characters under the limit than 1 over.`
    : null;

async function genText(
  ctx: PipelineContext,
  field: string,
  messages: LlmMessage[],
  schema: JsonSchema,
  hardLimit: number,
): Promise<GeneratedField> {
  const value = await callWithRetry(
    ctx,
    field,
    messages,
    schema,
    parseText(field),
    overLimit(field, hardLimit),
  );
  return { text: value.text, chars: value.text.length, rationale: value.rationale };
}

const BULLET_MIN = 10;
const BULLET_MAX = 500;
const BULLETS_TOTAL_MAX = 1000;

function bulletsViolation(value: { bullets: string[] }): string | null {
  if (value.bullets.length !== 5) {
    return `You returned ${value.bullets.length} bullets; exactly 5 are required.`;
  }
  const bad = value.bullets.find((b) => b.length < BULLET_MIN || b.length > BULLET_MAX);
  if (bad !== undefined) {
    return `One bullet was ${bad.length} characters; each must be ${BULLET_MIN} to ${BULLET_MAX}.`;
  }
  const total = value.bullets.reduce((n, b) => n + b.length, 0);
  if (total > BULLETS_TOTAL_MAX) {
    return `Your five bullets totalled ${total} characters; the mobile budget is ${BULLETS_TOTAL_MAX} across all five. Compress them while keeping the keyword heads.`;
  }
  return null;
}

async function genBullets(
  ctx: PipelineContext,
  input: string,
  title: string,
  highlights: string,
): Promise<GeneratedBullets> {
  const value = await callWithRetry(
    ctx,
    'bullets',
    bulletsMessages(input, title, highlights),
    BULLETS_JSON_SCHEMA,
    (raw) => {
      const parsed = bulletsReplySchema.safeParse(raw);
      if (!parsed.success) {
        throw new AppError(`llm bullets reply failed validation: ${parsed.error.message}`, 502, 'LLM');
      }
      return parsed.data;
    },
    bulletsViolation,
  );
  const chars = value.bullets.reduce((n, b) => n + b.length, 0);
  return { items: value.bullets, chars, rationale: value.rationale };
}

const genTitle = (ctx: PipelineContext, input: string) =>
  genText(ctx, 'title', titleMessages(input), TITLE_JSON_SCHEMA, 75);

const genHighlights = (ctx: PipelineContext, input: string, title: string) =>
  genText(ctx, 'item highlights', highlightsMessages(input, title), HIGHLIGHTS_JSON_SCHEMA, 125);

const genDescription = (
  ctx: PipelineContext,
  input: string,
  title: string,
  highlights: string,
  bullets: string[],
) =>
  genText(
    ctx,
    'description',
    descriptionMessages(input, title, highlights, bullets),
    DESCRIPTION_JSON_SCHEMA,
    2000,
  );

async function generateOnly(
  ctx: PipelineContext,
  input: string,
  only: GeneratedFieldName,
  prior: GeneratedListing,
): Promise<GeneratedListing> {
  switch (only) {
    case 'title':
      return { ...prior, title: await genTitle(ctx, input) };
    case 'highlights':
      return { ...prior, itemHighlights: await genHighlights(ctx, input, prior.title.text) };
    case 'bullets':
      return {
        ...prior,
        bullets: await genBullets(ctx, input, prior.title.text, prior.itemHighlights.text),
      };
    case 'description':
      return {
        ...prior,
        description: await genDescription(
          ctx,
          input,
          prior.title.text,
          prior.itemHighlights.text,
          prior.bullets.items,
        ),
      };
  }
}

/**
 * Generate the four post-July-2026 listing fields from the tag set: four
 * chained, schema-strict fast-tier calls (Title → Highlights → Bullets →
 * Description), each later prompt seeing the earlier fields to avoid
 * repetition. Persists a complete four-field document per version.
 */
export async function generate(
  listing: Listing,
  tags: TagSet,
  ctx: PipelineContext,
  opts: GenerateOptions = {},
): Promise<GeneratedListing> {
  const input = renderGenerationInput(listing, tags);

  let result: GeneratedListing;
  if (opts.only) {
    if (!opts.prior) throw new ValidationError('`only` requires a prior stored generation');
    result = { ...(await generateOnly(ctx, input, opts.only, opts.prior)), generatedAt: now() };
  } else {
    const title = await genTitle(ctx, input);
    const itemHighlights = await genHighlights(ctx, input, title.text);
    const bullets = await genBullets(ctx, input, title.text, itemHighlights.text);
    const description = await genDescription(
      ctx,
      input,
      title.text,
      itemHighlights.text,
      bullets.items,
    );
    result = { title, itemHighlights, bullets, description, generatedAt: now() };
  }

  await ctx.artifacts.saveGenerated(listing.ref, result);
  ctx.logger.info(
    {
      asin: listing.ref.asin,
      marketplace: listing.ref.marketplace,
      only: opts.only ?? 'all',
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
