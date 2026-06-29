/**
 * Quota / paywall: gate runs beyond a free allowance. Phase 0: thin contract +
 * permissive stub. Real impl: track usage, integrate payments, unlock tiers.
 */
export interface BillingService {
  canStartRun(userId: string): Promise<boolean>;
  recordRun(userId: string): Promise<void>;
}

export class StubBillingService implements BillingService {
  async canStartRun(_userId: string): Promise<boolean> {
    return true;
  }

  async recordRun(_userId: string): Promise<void> {
    // no-op
  }
}
