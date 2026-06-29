import type { Run } from '../domain/run';

/** Storage contract for evaluation runs. Swap the impl (memory → db) freely. */
export interface RunRepository {
  create(run: Run): Promise<void>;
  get(id: string): Promise<Run | null>;
  save(run: Run): Promise<void>;
  listByUser(userId: string): Promise<Run[]>;
}
