import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Listing, ListingRef } from '../../../domain/listing';
import type { ArtifactStore, RawArtifact, RawArtifactMeta } from '../artifact-store';

interface RawPointer extends RawArtifactMeta {
  file: string;
}

interface ListingPointer {
  parsedAt: string;
  file: string;
}

const tsSlug = (iso: string) => iso.replace(/[:.]/g, '-');

/**
 * Versioned filesystem store:
 *   <base>/scrape/<MARKET>_<ASIN>/<ts>__<scraper>.html  (+ latest.json pointer)
 *   <base>/parse/<MARKET>_<ASIN>/<ts>.json              (+ latest.json pointer)
 */
export class FsArtifactStore implements ArtifactStore {
  constructor(private readonly baseDir: string) {}

  private dir(kind: 'scrape' | 'parse', ref: ListingRef): string {
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

  async saveListing(ref: ListingRef, listing: Listing): Promise<void> {
    const dir = this.dir('parse', ref);
    await mkdir(dir, { recursive: true });
    const parsedAt = new Date().toISOString();
    const file = `${tsSlug(parsedAt)}.json`;
    await writeFile(join(dir, file), JSON.stringify(listing, null, 2));
    const pointer: ListingPointer = { parsedAt, file };
    await writeFile(join(dir, 'latest.json'), JSON.stringify(pointer, null, 2));
  }

  async loadListing(ref: ListingRef): Promise<Listing | null> {
    const dir = this.dir('parse', ref);
    const pointer = await this.readJson<ListingPointer>(join(dir, 'latest.json'));
    if (!pointer) return null;
    return this.readJson<Listing>(join(dir, pointer.file));
  }

  private async readJson<T>(path: string): Promise<T | null> {
    try {
      return JSON.parse(await readFile(path, 'utf8')) as T;
    } catch {
      return null;
    }
  }
}
