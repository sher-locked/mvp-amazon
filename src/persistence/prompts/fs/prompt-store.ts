import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PromptOverride, PromptSlotId, PromptStore } from '../prompt-store';

interface Pointer {
  savedAt: string;
  file: string;
}

const tsSlug = (iso: string) => iso.replace(/[:.]/g, '-');

/**
 * Versioned filesystem store, mirroring FsArtifactStore's layout:
 *   <base>/prompts/<slot>/<ts>.json  (+ latest.json pointer)
 * Revert deletes only latest.json — every saved version stays on disk.
 */
export class FsPromptStore implements PromptStore {
  constructor(private readonly baseDir: string) {}

  private dir(slot: PromptSlotId): string {
    return join(this.baseDir, 'prompts', slot);
  }

  async saveOverride(slot: PromptSlotId, text: string, note?: string): Promise<PromptOverride> {
    const dir = this.dir(slot);
    await mkdir(dir, { recursive: true });
    const savedAt = new Date().toISOString();
    const override: PromptOverride = { text, savedAt, ...(note ? { note } : {}) };
    const file = `${tsSlug(savedAt)}.json`;
    await writeFile(join(dir, file), JSON.stringify(override, null, 2));
    const pointer: Pointer = { savedAt, file };
    await writeFile(join(dir, 'latest.json'), JSON.stringify(pointer, null, 2));
    return override;
  }

  async loadOverride(slot: PromptSlotId): Promise<PromptOverride | null> {
    const dir = this.dir(slot);
    const pointer = await this.readJson<Pointer>(join(dir, 'latest.json'));
    if (!pointer) return null;
    return this.readJson<PromptOverride>(join(dir, pointer.file));
  }

  async revert(slot: PromptSlotId): Promise<void> {
    await rm(join(this.dir(slot), 'latest.json'), { force: true });
  }

  private async readJson<T>(path: string): Promise<T | null> {
    try {
      return JSON.parse(await readFile(path, 'utf8')) as T;
    } catch {
      return null;
    }
  }
}
