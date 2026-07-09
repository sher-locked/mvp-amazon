import { createHash } from 'node:crypto';
import type { PromptSlotId, PromptStore } from '../../persistence/prompts/prompt-store';
import { RESEARCH_OUTPUT_CONTRACT, RESEARCH_SYSTEM_DEFAULT } from './research/identity';
import { TAGS_SYSTEM_DEFAULT } from './research/tags';
import { LISTING_SYSTEM_DEFAULT } from './generate/listing';

/**
 * One editable LLM call site. The system prompt is the editable unit; the
 * user message (evidence, research notes, generation input) is code-assembled
 * data wiring and never editable. `fixedSuffix` is a code-owned block always
 * appended after the editable text — used where no provider-enforced schema
 * protects the reply shape (research).
 */
export interface PromptSlot {
  id: PromptSlotId;
  title: string;
  description: string;
  defaultText: string;
  fixedSuffix?: string;
  /** shown in the editor UI: what stays enforced in code no matter the edit */
  constraints: string[];
  /** shown in the editor UI: what the code sends as the user message */
  inputsNote: string;
}

export const PROMPT_SLOTS: Record<PromptSlotId, PromptSlot> = {
  research: {
    id: 'research',
    title: 'Research',
    description:
      'Call 1 — web-enabled. Resolves the SKU identity tuple and writes free-form research notes that the tag call consumes.',
    defaultText: RESEARCH_SYSTEM_DEFAULT,
    fixedSuffix: RESEARCH_OUTPUT_CONTRACT,
    constraints: [
      'Runs with web search enabled — expect 50–75 s and real cost per call.',
      'The JSON output contract shown below is appended automatically; the reply is validated in code and the call fails with a clear error if the shape breaks.',
      'Downstream, the tag call consumes identity + notes — keep instructing the model to produce useful notes.',
    ],
    inputsNote:
      'User message (code-assembled): the scraped PDP evidence block — ASIN, title, bullets, description, A+ content, image counts.',
  },
  tag: {
    id: 'tag',
    title: 'Tag bucketing',
    description:
      'Call 2 — no web. Buckets evidence + stored research into the flat scope × type tag set the matrix renders.',
    defaultText: TAGS_SYSTEM_DEFAULT,
    constraints: [
      'Output shape is schema-enforced at the provider level (fixed scope/type enums, all tag fields required) — the matrix always renders whatever you write here.',
      'Cross-scope duplicate tag values are deduped in code after the call (highest scope wins).',
      'No web access — the model sees only the evidence and research notes it is given.',
    ],
    inputsNote:
      'User message (code-assembled): the scraped PDP evidence block + resolved identity JSON + research notes.',
  },
  generate: {
    id: 'generate',
    title: 'Generate listing',
    description:
      'Call 3 — single-shot, fast tier. Produces all four post-July-2026 fields (title, item highlights, five bullets, description) in one reply.',
    defaultText: LISTING_SYSTEM_DEFAULT,
    constraints: [
      'Output shape (four fields, exactly 5 bullets) is schema-enforced at the provider level.',
      'Hard character limits are enforced in code: violations trigger ONE corrective re-prompt, then the call fails.',
      'Tags are pre-filtered in code before the prompt sees them: inferred + compliance-sensitive dropped, confidence < 0.6 dropped.',
    ],
    inputsNote:
      'User message (code-assembled): one JSON object with identity, the filtered tags, and the scraped listing fields.',
  },
};

const hash8 = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 8);

/** Version id of the in-code default — changes when the default text changes. */
export const defaultVersion = (slot: PromptSlotId): string =>
  `default#${hash8(PROMPT_SLOTS[slot].defaultText)}`;

export interface ResolvedPrompt {
  /** full system prompt ready for the LLM (editable text + fixed suffix) */
  system: string;
  source: 'default' | 'custom';
  /** stamped into artifacts: `default#<hash8>` | `custom#<ISOts>` */
  version: string;
}

/** Active system prompt for a slot: stored override if present, else the code default. */
export async function resolvePrompt(
  slot: PromptSlotId,
  store: PromptStore,
): Promise<ResolvedPrompt> {
  const meta = PROMPT_SLOTS[slot];
  const override = await store.loadOverride(slot);
  const text = override?.text ?? meta.defaultText;
  return {
    system: meta.fixedSuffix ? `${text}\n\n${meta.fixedSuffix}` : text,
    source: override ? 'custom' : 'default',
    version: override ? `custom#${override.savedAt}` : defaultVersion(slot),
  };
}
