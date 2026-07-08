import { randomUUID } from 'node:crypto';
import { now } from '../lib/result';
import type { Listing } from './listing';
import type { SkuResearch, TagSet } from './research';
import type { Evaluation } from './evaluation';
import type { GeneratedListing } from './generation';

export type RunStatus = 'queued' | 'running' | 'done' | 'failed';

export const STAGE_NAMES = [
  'ingest',
  'scrape',
  'parse',
  'research',
  'tag',
  'evaluate-content',
  'evaluate-rufus',
  'evaluate-llm-search',
  'generate',
] as const;

export type StageName = (typeof STAGE_NAMES)[number];
export type StageStatus = 'pending' | 'running' | 'done' | 'failed';

export interface StageState {
  name: StageName;
  status: StageStatus;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export interface RunResult {
  listing: Listing;
  research: SkuResearch;
  tags: TagSet;
  evaluation: Evaluation;
  generated: GeneratedListing;
}

export interface Run {
  id: string;
  input: string;
  userId?: string;
  status: RunStatus;
  stages: StageState[];
  result?: RunResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export function newRun(input: string, userId?: string): Run {
  const ts = now();
  return {
    id: randomUUID(),
    input,
    userId,
    status: 'queued',
    stages: STAGE_NAMES.map((name) => ({ name, status: 'pending' })),
    createdAt: ts,
    updatedAt: ts,
  };
}
