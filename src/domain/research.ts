export type TagType = 'fact' | 'functional' | 'sensory' | 'emotional' | 'occasion' | 'audience';

/** Scope chain, highest first. A tag lives at the highest scope where it is true. */
export type TagScope = 'brand' | 'category' | 'family' | 'sku';

export type TagSource = 'observed' | 'inferred';

export interface Tag {
  value: string;
  type: TagType;
  scope: TagScope;
  /** Regulated/verifiable claim (e.g. "kills 99.9% germs") — a flag, not a type. */
  complianceSensitive: boolean;
  source: TagSource;
  /** Where it came from, e.g. amazon_pdp_bullet, amazon_aplus, llm_research. */
  evidence: string;
  confidence: number;
}

/**
 * The SKU identity tuple: {brand} × {category} × {variantAttributes} × {size}.
 * There is no canonical title — displayName is derived, never parsed.
 */
export interface Identity {
  brand: { name: string; parentBrand: string | null };
  category: string;
  /** family = brand + category + claim-bearing variant axes (formulation, fragrance, ...) */
  family: { name: string; variantAttributes: Record<string, string> };
  /** logistical axes only (size, count, packaging, ...) */
  sku: Record<string, string>;
  displayName: string;
}

/** Output of the web-enabled research call (call 1). */
export interface SkuResearch {
  identity: Identity;
  notes: string;
  sources: string[];
  researchedAt: string;
}

/** Output of the bucketing call (call 2) — what downstream stages consume. */
export interface TagSet {
  identity: Identity;
  tags: Tag[];
}
