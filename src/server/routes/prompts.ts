import type { FastifyInstance } from 'fastify';
import type { Container } from '../../container';
import { promptParams, promptPutBody } from '../schemas';
import { PROMPT_SLOTS, defaultVersion } from '../../llm/prompts/registry';
import type { PromptOverride, PromptSlotId } from '../../persistence/prompts/prompt-store';

const activeOf = (id: PromptSlotId, override: PromptOverride | null) =>
  override
    ? { source: 'custom' as const, version: `custom#${override.savedAt}` }
    : { source: 'default' as const, version: defaultVersion(id) };

/**
 * View/edit the three global LLM system prompts. Defaults live in code; a PUT
 * stores a new override version (global for everyone), DELETE reverts to the
 * code default (history stays on disk). The user-message wiring and all
 * schema/limit enforcement stay in code and are not editable here.
 */
export function registerPromptRoutes(app: FastifyInstance, c: Container): void {
  app.get('/prompts', async (_req, reply) => {
    const prompts = await Promise.all(
      Object.values(PROMPT_SLOTS).map(async (slot) => {
        const override = await c.ctx.prompts.loadOverride(slot.id);
        return {
          id: slot.id,
          title: slot.title,
          description: slot.description,
          constraints: slot.constraints,
          inputsNote: slot.inputsNote,
          fixedSuffix: slot.fixedSuffix ?? null,
          defaultText: slot.defaultText,
          defaultVersion: defaultVersion(slot.id),
          override,
          active: activeOf(slot.id, override),
        };
      }),
    );
    return reply.send({ prompts });
  });

  app.put('/prompts/:id', async (req, reply) => {
    const { id } = promptParams.parse(req.params);
    const { text, note } = promptPutBody.parse(req.body);
    const override = await c.ctx.prompts.saveOverride(id, text, note);
    c.logger.info({ slot: id, savedAt: override.savedAt }, 'prompt override saved');
    return reply.send({ id, override, active: activeOf(id, override) });
  });

  app.delete('/prompts/:id', async (req, reply) => {
    const { id } = promptParams.parse(req.params);
    await c.ctx.prompts.revert(id);
    c.logger.info({ slot: id }, 'prompt reverted to default');
    return reply.send({ id, override: null, active: activeOf(id, null) });
  });
}
