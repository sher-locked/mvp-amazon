import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Listing, ListingRef } from '../../../domain/listing';
import type { SkuResearch, TagSet } from '../../../domain/research';
import type { GeneratedListing } from '../../../domain/generation';
import type { ArtifactStore, RawArtifact, RawArtifactMeta } from '../artifact-store';

type ArtifactKind = 'scrape' | 'parse' | 'research' | 'tags' | 'generate';

interface RawPointer extends RawArtifactMeta {
  file: string;
}

interface JsonPointer {
  savedAt: string;
  file: string;
}

const tsSlug = (iso: string) => iso.replace(/[:.]/g, '-');

/**
 * Versioned filesystem store:
 *   <base>/scrape/<MARKET>_<ASIN>/<ts>__<scraper>.html  (+ latest.json pointer)
 *   <base>/<kind>/<MARKET>_<ASIN>/<ts>.json             (+ latest.json pointer)
 * for JSON kinds: parse, research, tags.
 */
export class FsArtifactStore implements ArtifactStore {
  constructor(private readonly baseDir: string) {}

  private dir(kind: ArtifactKind, ref: ListingRef): string {
    return join(this.baseDir, kind, `${ref.marketplace}_${ref.asin}`);
  }

  async saveRaw(ref: ListingRef, html: string, meta: RawArtifactMeta): Promise<void> {
    const dir = this.dir('scrape', ref);
    await mkdir(dir, { recursive: true });
    const file = `${tsSlug(meta.fetchedAt)}__${meta.scraper}.html`;
    await writeFile(join(dir, file), html);
    const pointer: RawPointer = { ...meta, file };
    await writeFile(join(dir, 'latest.json'), JSON.stringify(pointer, null, 2));
  }

  async loadRaw(ref: ListingRef): Promise<RawArtifact | null> {
    const dir = this.dir('scrape', ref);
    const pointer = await this.readJson<RawPointer>(join(dir, 'latest.json'));
    if (!pointer) return null;
    try {
      const html = await readFile(join(dir, pointer.file), 'utf8');
      const { file: _file, ...meta } = pointer;
      return { html, meta };
    } catch {
      return null;
    }
  }

  async listScraped(): Promise<string[]> {
    try {
      const entries = await readdir(join(this.baseDir, 'scrape'), { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
    } catch {
      return [];
    }
  }

  async saveListing(ref: ListingRef, listing: Listing): Promise<void> {
    return this.saveVersioned('parse', ref, listing);
  }

  async loadListing(ref: ListingRef): Promise<Listing | null> {
    return this.loadVersioned<Listing>('parse', ref);
  }

  async saveResearch(ref: ListingRef, research: SkuResearch): Promise<void> {
    return this.saveVersioned('research', ref, research);
  }

  async loadResearch(ref: ListingRef): Promise<SkuResearch | null> {
    return this.loadVersioned<SkuResearch>('research', ref);
  }

  async saveTags(ref: ListingRef, tags: TagSet): Promise<void> {
    return this.saveVersioned('tags', ref, tags);
  }

  async loadTags(ref: ListingRef): Promise<TagSet | null> {
    return this.loadVersioned<TagSet>('tags', ref);
  }

  async saveGenerated(ref: ListingRef, generated: GeneratedListing): Promise<void> {
    return this.saveVersioned('generate', ref, generated);
  }

  async loadGenerated(ref: ListingRef): Promise<GeneratedListing | null> {
    return this.loadVersioned<GeneratedListing>('generate', ref);
  }

  private async saveVersioned(kind: ArtifactKind, ref: ListingRef, value: unknown): Promise<void> {
    const dir = this.dir(kind, ref);
    await mkdir(dir, { recursive: true });
    const savedAt = new Date().toISOString();
    const file = `${tsSlug(savedAt)}.json`;
    await writeFile(join(dir, file), JSON.stringify(value, null, 2));
    const pointer: JsonPointer = { savedAt, file };
    await writeFile(join(dir, 'latest.json'), JSON.stringify(pointer, null, 2));
  }

  private async loadVersioned<T>(kind: ArtifactKind, ref: ListingRef): Promise<T | null> {
    const dir = this.dir(kind, ref);
    const pointer = await this.readJson<JsonPointer>(join(dir, 'latest.json'));
    if (!pointer) return null;
    return this.readJson<T>(join(dir, pointer.file));
  }

  private async readJson<T>(path: string): Promise<T | null> {
    try {
      return JSON.parse(await readFile(path, 'utf8')) as T;
    } catch {
      return null;
    }
  }
}
