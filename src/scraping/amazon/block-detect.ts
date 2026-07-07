/**
 * Detect Amazon bot walls / CAPTCHAs in fetched HTML. Markers proven against
 * real responses in spikes/scrape-pdp.ts. HTTP 200 does not mean unblocked.
 */
const BLOCK_MARKERS = [
  'Type the characters you see in this image',
  'Enter the characters you see below',
  "make sure you're not a robot",
  'To discuss automated access to Amazon data',
  'Click the button below to continue shopping',
  'api-services-support@amazon.com',
  'Robot Check',
  'captcha',
] as const;

export interface BlockCheck {
  blocked: boolean;
  marker?: string;
}

export function isBlocked(html: string): BlockCheck {
  const haystack = html.toLowerCase();
  const marker = BLOCK_MARKERS.find((m) => haystack.includes(m.toLowerCase()));
  return marker ? { blocked: true, marker } : { blocked: false };
}
