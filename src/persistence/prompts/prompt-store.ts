/** The three editable LLM call sites. */
export type PromptSlotId = 'research' | 'tag' | 'generate';

/** One saved global prompt override; savedAt doubles as the version id. */
export interface PromptOverride {
  text: string;
  savedAt: string;
  note?: string;
}

/**
 * Global (not per-user) prompt overrides, versioned. Reverting removes the
 * active pointer but keeps history, so the slot tracks the code default again.
 */
export interface PromptStore {
  saveOverride(slot: PromptSlotId, text: string, note?: string): Promise<PromptOverride>;
  loadOverride(slot: PromptSlotId): Promise<PromptOverride | null>;
  revert(slot: PromptSlotId): Promise<void>;
}

/** Always answers "no override". For tests / read-only environments. */
export class NoopPromptStore implements PromptStore {
  async saveOverride(_slot: PromptSlotId, text: string, note?: string): Promise<PromptOverride> {
    return { text, savedAt: new Date().toISOString(), ...(note ? { note } : {}) };
  }
  async loadOverride(): Promise<PromptOverride | null> {
    return null;
  }
  async revert(): Promise<void> {}
}
