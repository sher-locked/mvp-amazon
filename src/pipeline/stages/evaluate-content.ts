import type { Listing } from '../../domain/listing';
import type { SourceOfTruth } from '../../domain/research';
import type { AssetEvaluation, ContentEvaluation } from '../../domain/evaluation';
import type { PipelineContext } from '../context';

const mockAsset = (asset: AssetEvaluation['asset']): AssetEvaluation => ({
  asset,
  score: { value: 0, max: 100, notes: '[mock] not yet scored' },
  findings: [],
});

/**
 * Score listing assets against Amazon guidelines + marketing rubric.
 * Phase 0: mock. Phase 4: run prompts in llm/prompts/content/* via ctx.llm.
 */
export async function evaluateContent(
  _listing: Listing,
  _sot: SourceOfTruth,
  _ctx: PipelineContext,
): Promise<ContentEvaluation> {
  const assets = [
    mockAsset('title'),
    mockAsset('description'),
    mockAsset('hero'),
    mockAsset('secondary'),
  ];
  return { assets, overall: { value: 0, max: 100, notes: '[mock]' } };
}
