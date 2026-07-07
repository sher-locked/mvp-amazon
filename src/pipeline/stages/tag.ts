import { AppError } from '../../lib/errors';
import type { Listing } from '../../domain/listing';
import type { SkuResearch, Tag, TagScope, TagSet } from '../../domain/research';
import { parseJsonReply } from '../../llm/json';
import {
  TAG_SET_JSON_SCHEMA,
  tagsMessages,
  tagsReplySchema,
  toTagSet,
} from '../../llm/prompts/research/tags';
import type { PipelineContext } from '../context';

const SCOPE_RANK: Record<TagScope, number> = { brand: 0, category: 1, family: 2, sku: 3 };

/**
 * Enforce the storage invariant "each tag value lives exactly once, at the
 * highest scope where it is true": on repeats, keep the highest-scope
 * instance (first occurrence on ties) and drop the rest.
 */
export function dedupeAcrossScopes(tags: Tag[]): Tag[] {
  const winners = new Map<string, Tag>();
  for (const tag of tags) {
    const key = tag.value.trim().toLowerCase();
    const current = winners.get(key);
    if (!current || SCOPE_RANK[tag.scope] < SCOPE_RANK[current.scope]) winners.set(key, tag);
  }
  return tags.filter((tag) => winners.get(tag.value.trim().toLowerCase()) === tag);
}

/**
 * Call 2: bucket evidence + research into the flat scope-x-type tag set via
 * strict structured output. No web — cheap to re-run against stored research.
 */
export async function tag(
  listing: Listing,
  research: SkuResearch,
  ctx: PipelineContext,
): Promise<TagSet> {
  const reply = await ctx.llm.complete({
    messages: tagsMessages(listing, research),
    schema: TAG_SET_JSON_SCHEMA,
  });

  const parsed = tagsReplySchema.safeParse(parseJsonReply(reply.text));
  if (!parsed.success) {
    throw new AppError(`llm tags reply failed validation: ${parsed.error.message}`, 502, 'LLM');
  }

  const tagSet = toTagSet(parsed.data);
  tagSet.tags = dedupeAcrossScopes(tagSet.tags);

  await ctx.artifacts.saveTags(listing.ref, tagSet);
  ctx.logger.info(
    {
      asin: listing.ref.asin,
      marketplace: listing.ref.marketplace,
      tags: tagSet.tags.length,
    },
    'tagged sku',
  );
  return tagSet;
}
