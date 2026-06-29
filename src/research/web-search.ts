import type { PipelineContext } from '../pipeline/context';

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Web/agentic search for brand + product marketing material.
 * Phase 0: mock. Phase 3+: real headless web search or search API.
 */
export async function webSearch(query: string, _ctx: PipelineContext): Promise<SearchHit[]> {
  return [
    { title: `[mock] result for "${query}"`, url: '[mock] url', snippet: '[mock] snippet' },
  ];
}
