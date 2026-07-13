import type { Listing, ListingRef } from '../../domain/listing';
import type { SkuResearch, TagSet } from '../../domain/research';
import type { GeneratedListing } from '../../domain/generation';

/** Provenance recorded alongside each raw scrape artifact. */
export interface RawArtifactMeta {
  scraper: string;
  status: number;
  country?: string;
  url: string;
  fetchedAt: string;
  blocked: boolean;
  blockMarker?: string;
  durationMs?: number;
}

export interface RawArtifact {
  html: string;
  meta: RawArtifactMeta;
}

/**
 * Versioned storage for pipeline artifacts (raw scrape HTML, parsed Listings).
 * Filesystem-backed for now; swap for a DB/blob store behind this interface.
 */
export interface ArtifactStore {
  saveRaw(ref: ListingRef, html: string, meta: RawArtifactMeta): Promise<void>;
  loadRaw(ref: ListingRef): Promise<RawArtifact | null>;
  /** ids (`<MARKET>_<ASIN>`) of every listing with a stored scrape — cheap readdir, no HTML reads */
  listScraped(): Promise<string[]>;
  saveListing(ref: ListingRef, listing: Listing): Promise<void>;
  loadListing(ref: ListingRef): Promise<Listing | null>;
  saveResearch(ref: ListingRef, research: SkuResearch): Promise<void>;
  loadResearch(ref: ListingRef): Promise<SkuResearch | null>;
  saveTags(ref: ListingRef, tags: TagSet): Promise<void>;
  loadTags(ref: ListingRef): Promise<TagSet | null>;
  /** always a complete four-field document — never a partial */
  saveGenerated(ref: ListingRef, generated: GeneratedListing): Promise<void>;
  loadGenerated(ref: ListingRef): Promise<GeneratedListing | null>;
}

/** Discards everything. For tests / environments without a writable disk. */
export class NoopArtifactStore implements ArtifactStore {
  async saveRaw(): Promise<void> {}
  async loadRaw(): Promise<RawArtifact | null> {
    return null;
  }
  async listScraped(): Promise<string[]> {
    return [];
  }
  async saveListing(): Promise<void> {}
  async loadListing(): Promise<Listing | null> {
    return null;
  }
  async saveResearch(): Promise<void> {}
  async loadResearch(): Promise<SkuResearch | null> {
    return null;
  }
  async saveTags(): Promise<void> {}
  async loadTags(): Promise<TagSet | null> {
    return null;
  }
  async saveGenerated(): Promise<void> {}
  async loadGenerated(): Promise<GeneratedListing | null> {
    return null;
  }
}
