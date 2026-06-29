export type Marketplace = 'US' | 'UK' | 'DE' | 'FR' | 'ES' | 'IT' | 'IN' | 'JP' | 'CA' | 'AU';

export interface ListingRef {
  asin: string;
  marketplace: Marketplace;
  url: string;
}

export interface ListingImage {
  url: string;
  alt?: string;
}

export interface Listing {
  ref: ListingRef;
  title: string;
  description: string;
  bullets: string[];
  heroImage: ListingImage | null;
  secondaryImages: ListingImage[];
}
