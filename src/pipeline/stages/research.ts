import { AppError } from '../../lib/errors';
import type { Listing } from '../../domain/listing';
import type { SkuResearch } from '../../domain/research';
import { parseJsonReply } from '../../llm/json';
import { identityMessages, researchReplySchema } from '../../llm/prompts/research/identity';
import { resolvePrompt } from '../../llm/prompts/registry';
import type { PipelineContext } from '../context';

/**
 * Call 1: web-enabled LLM research. Resolves the identity tuple and gathers
 * free-form notes + source URLs; persisted so re-bucketing (`tag`) is free.
 */
export async function research(listing: Listing, ctx: PipelineContext): Promise<SkuResearch> {
  const prompt = await resolvePrompt('research', ctx.prompts);
  const reply = await ctx.llm.complete({ messages: identityMessages(prompt.system, listing), web: true });

  const parsed = researchReplySchema.safeParse(parseJsonReply(reply.text));
  if (!parsed.success) {
    throw new AppError(`llm research reply failed validation: ${parsed.error.message}`, 502, 'LLM');
  }

  const research: SkuResearch = {
    identity: parsed.data.identity,
    notes: parsed.data.notes,
    sources: reply.sources ?? [],
    researchedAt: new Date().toISOString(),
    promptVersion: prompt.version,
  };

  await ctx.artifacts.saveResearch(listing.ref, research);
  ctx.logger.info(
    {
      asin: listing.ref.asin,
      marketplace: listing.ref.marketplace,
      displayName: research.identity.displayName,
      sources: research.sources.length,
    },
    'researched sku',
  );
  return research;
}
