export type ClaimScope = 'brand' | 'product' | 'category';

export interface Claim {
  scope: ClaimScope;
  text: string;
  source?: string;
  confidence?: number;
}

export interface SourceOfTruth {
  claims: Claim[];
  keywords: string[];
}
