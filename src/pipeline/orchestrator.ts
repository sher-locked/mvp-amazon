import { now } from '../lib/result';
import { NotFoundError } from '../lib/errors';
import type { Run, StageName } from '../domain/run';
import type { RunRepository } from '../persistence/run-repository';
import type { PipelineContext } from './context';
import { ingest } from './stages/ingest';
import { scrape } from './stages/scrape';
import { research } from './stages/research';
import { evaluateContent } from './stages/evaluate-content';
import { evaluateRufus } from './stages/evaluate-rufus';
import { evaluateLlmSearch } from './stages/evaluate-llm-search';
import { recommend } from './stages/recommend';

export interface OrchestratorDeps {
  repo: RunRepository;
  ctx: PipelineContext;
}

async function runStage<T>(
  run: Run,
  repo: RunRepository,
  name: StageName,
  fn: () => Promise<T> | T,
): Promise<T> {
  const stage = run.stages.find((s) => s.name === name);
  if (!stage) throw new Error(`unknown stage: ${name}`);

  stage.status = 'running';
  stage.startedAt = now();
  run.updatedAt = now();
  await repo.save(run);

  try {
    const out = await fn();
    stage.status = 'done';
    stage.finishedAt = now();
    run.updatedAt = now();
    await repo.save(run);
    return out;
  } catch (e) {
    stage.status = 'failed';
    stage.error = e instanceof Error ? e.message : String(e);
    stage.finishedAt = now();
    await repo.save(run);
    throw e;
  }
}

/** Execute the full evaluation pipeline for a run, persisting progress. */
export async function executeRun(runId: string, deps: OrchestratorDeps): Promise<void> {
  const { repo, ctx } = deps;
  const run = await repo.get(runId);
  if (!run) throw new NotFoundError(`run ${runId}`);

  run.status = 'running';
  run.updatedAt = now();
  await repo.save(run);

  try {
    const ref = await runStage(run, repo, 'ingest', () => ingest(run.input));
    const listing = await runStage(run, repo, 'scrape', () => scrape(ref, ctx));
    const sourceOfTruth = await runStage(run, repo, 'research', () => research(listing, ctx));
    const content = await runStage(run, repo, 'evaluate-content', () =>
      evaluateContent(listing, sourceOfTruth, ctx),
    );
    const rufus = await runStage(run, repo, 'evaluate-rufus', () =>
      evaluateRufus(listing, sourceOfTruth, ctx),
    );
    const llmSearch = await runStage(run, repo, 'evaluate-llm-search', () =>
      evaluateLlmSearch(listing, sourceOfTruth, ctx),
    );
    const evaluation = { content, rufus, llmSearch };
    const recommendations = await runStage(run, repo, 'recommend', () =>
      recommend({ listing, sourceOfTruth, evaluation }, ctx),
    );

    run.result = { listing, sourceOfTruth, evaluation, recommendations };
    run.status = 'done';
  } catch (e) {
    run.status = 'failed';
    run.error = e instanceof Error ? e.message : String(e);
    ctx.logger.error({ err: e, runId }, 'run failed');
  }

  run.updatedAt = now();
  await repo.save(run);
}
