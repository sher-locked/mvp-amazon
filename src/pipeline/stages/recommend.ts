import type { Listing } from '../../domain/listing';
import type { SourceOfTruth } from '../../domain/research';
import type { Evaluation, Recommendation } from '../../domain/evaluation';
import type { PipelineContext } from '../context';

export interface RecommendInput {
  listing: Listing;
  sourceOfTruth: SourceOfTruth;
  evaluation: Evaluation;
}

/**
 * Synthesize prioritized content changes from the three evaluation axes.
 * Phase 0: mock. Phase 4: LLM synthesis over findings + source-of-truth.
 */
export async function recommend(
  _input: RecommendInput,
  _ctx: PipelineContext,
): Promise<Recommendation[]> {
  return [
    {
      asset: 'general',
      priority: 'low',
      change: '[mock] recommendation pending real evaluation',
      rationale: '[mock]',
    },
  ];
}
