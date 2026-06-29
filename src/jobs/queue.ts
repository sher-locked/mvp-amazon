import type { Logger } from '../lib/logger';

export type Job = () => Promise<void>;

/**
 * Minimal in-process job queue: runs jobs sequentially off the request path.
 * Phase 0 stand-in for a real queue (BullMQ / SQS) added when we need
 * durability, retries, and concurrency.
 */
export class JobQueue {
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly logger: Logger) {}

  enqueue(job: Job): void {
    this.chain = this.chain.then(job).catch((err) => {
      this.logger.error({ err }, 'job failed');
    });
  }
}
