export type ContentAsset = 'title' | 'description' | 'hero' | 'secondary';

export interface Score {
  value: number;
  max: number;
  notes?: string;
}

export interface AssetEvaluation {
  asset: ContentAsset;
  score: Score;
  findings: string[];
}

export interface ContentEvaluation {
  assets: AssetEvaluation[];
  overall: Score;
}

export type DiscoverabilityChannel = 'rufus' | 'llm-search';

export interface DiscoverabilityResult {
  channel: DiscoverabilityChannel;
  searchable: boolean;
  retrievable: boolean;
  recommended: boolean;
  evidence: string[];
}

export interface Evaluation {
  content: ContentEvaluation;
  rufus: DiscoverabilityResult;
  llmSearch: DiscoverabilityResult;
}

export type Priority = 'high' | 'medium' | 'low';

export interface Recommendation {
  asset: ContentAsset | 'general';
  priority: Priority;
  change: string;
  rationale: string;
}
