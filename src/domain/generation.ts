/** One generated listing field; chars counted in code, never trusted from the LLM. */
export interface GeneratedField {
  text: string;
  chars: number;
  rationale: string;
}

export interface GeneratedBullets {
  items: string[];
  /** total across all five bullets — the mobile-view budget (< 1,000) */
  chars: number;
  rationale: string;
}

/** The four post-July-2026 Amazon listing fields, generated from the TagSet. */
export interface GeneratedListing {
  title: GeneratedField;
  itemHighlights: GeneratedField;
  bullets: GeneratedBullets;
  description: GeneratedField;
  generatedAt: string;
}
