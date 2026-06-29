/**
 * Spike 2 — drive Amazon Rufus and read its answers.
 * Goal: ask Rufus a buyer-style question and capture whether our ASIN is
 * searchable / retrievable / recommended.
 * Plan: BrightData Browser API (remote Chrome over CDP). Local Playwright likely blocked.
 *
 * Run: pnpm spike spikes/probe-rufus.ts "<asin>" "<question>"
 */
async function main(): Promise<void> {
  const asin = process.argv[2] ?? 'B08N5WRWNW';
  const question = process.argv[3] ?? 'best option for ...';
  console.log({ asin, question });

  // TODO: connect to BRIGHTDATA_BROWSER_WSE via CDP.
  // TODO: open the marketplace, trigger Rufus, type the question, capture responses.
  // TODO: detect if `asin` appears in Rufus recommendations; record evidence.
  console.log('next: connect BrightData browser, automate Rufus, capture results');
}

void main();
