import type { Marketplace } from '../../domain/listing';

/** ISO country for proxy egress per marketplace. BrightData uses `gb` for the UK. */
const MARKET_TO_COUNTRY: Record<Marketplace, string> = {
  US: 'us',
  UK: 'gb',
  DE: 'de',
  FR: 'fr',
  ES: 'es',
  IT: 'it',
  IN: 'in',
  JP: 'jp',
  CA: 'ca',
  AU: 'au',
};

export function countryForMarketplace(marketplace: Marketplace): string {
  return MARKET_TO_COUNTRY[marketplace];
}
