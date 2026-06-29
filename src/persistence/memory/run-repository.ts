import type { Run } from '../../domain/run';
import type { RunRepository } from '../run-repository';

/** In-memory run store for development. Replace with a db-backed impl later. */
export class InMemoryRunRepository implements RunRepository {
  private readonly runs = new Map<string, Run>();

  async create(run: Run): Promise<void> {
    this.runs.set(run.id, run);
  }

  async get(id: string): Promise<Run | null> {
    return this.runs.get(id) ?? null;
  }

  async save(run: Run): Promise<void> {
    this.runs.set(run.id, run);
  }

  async listByUser(userId: string): Promise<Run[]> {
    return [...this.runs.values()].filter((r) => r.userId === userId);
  }
}
