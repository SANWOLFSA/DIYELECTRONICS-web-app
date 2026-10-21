/**
 * Shared Marketplace listings store (read side).
 *
 * Single source of truth for items for sale, used by Marketplace.tsx and the
 * Home "Marketplace Stories" bar. Backed by real Firestore data:
 *   listings (status == 'active') + verifiedSellers (badge) + reviews (ratings).
 * No invented listings: when Firebase is not configured, or nothing is listed
 * yet, the list is simply empty and callers show an empty state.
 *
 * Subscriptions start lazily on the first subscriber and stop when the last
 * one leaves, so the Home bar and the Marketplace share one set of listeners.
 */
import { useSyncExternalStore } from 'react';
import { isFirebaseConfigured } from './firebase';
import {
  computeSellerRatings,
  subscribeActiveListings,
  subscribeReviews,
  subscribeVerifiedSellers,
  type ListingDoc,
  type Review,
  type SellerType,
  type VerifiedSeller,
} from './marketplace';
import { groupOfCategory, isNewCondition, type ListingGroup } from './partsFinder';

export interface ListingItem {
  id: string;
  title: string;
  category: string;
  /** Price in ZAR. */
  price: number;
  currency: string;
  condition: string;
  seller: {
    uid: string;
    name: string;
    type: SellerType;
    /** Average review rating, 0 when the seller has no reviews yet. */
    rating: number;
    reviewCount: number;
    /** True only when an admin has approved this seller's company verification. */
    isVerifiedCompany: boolean;
  };
  /** Listing photo, or a placeholder when the seller did not upload one. */
  image: string;
  hasPhoto: boolean;
  description: string;
  inStock: boolean;
  /** Part numbers / aliases and models it fits (spare-parts search + "Where to buy"). */
  partNumbers: string[];
  fits: string[];
  keywords: string[];
  town: string;
  province: string;
  country: string;
  shipsTo: string[];
  lat: number | null;
  lng: number | null;
  /** Seller uid when listed by a registered shop, else ''. */
  businessId: string;
  /** New vs used / salvage (from the condition). */
  isNew: boolean;
  group: ListingGroup;
}

/** Neutral placeholder used when a listing has no photo. */
export const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0e7ff"/><stop offset="1" stop-color="#d1fae5"/></linearGradient></defs>
      <rect width="400" height="300" fill="url(#g)"/>
      <g fill="none" stroke="#6366f1" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity="0.55">
        <rect x="150" y="100" width="100" height="100" rx="12"/>
        <path d="M170 100v-20M200 100v-20M230 100v-20M170 220v-20M200 220v-20M230 220v-20M130 125h20M130 150h20M130 175h20M250 125h20M250 150h20M250 175h20"/>
      </g>
      <text x="200" y="262" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" fill="#4f46e5" opacity="0.7">No photo yet</text>
    </svg>`
  );

export interface MarketplaceState {
  listings: ListingItem[];
  /** False until the first listings snapshot arrives. */
  loaded: boolean;
  configured: boolean;
  error: string | null;
}

let rawListings: ListingDoc[] = [];
let verified = new Map<string, VerifiedSeller>();
let reviews: Review[] = [];
let state: MarketplaceState = {
  listings: [],
  loaded: !isFirebaseConfigured,
  configured: isFirebaseConfigured,
  error: null,
};

const listeners = new Set<() => void>();
let stopAll: (() => void) | null = null;

function rebuild() {
  const ratings = computeSellerRatings(reviews);
  const listings: ListingItem[] = rawListings.map(l => {
    const r = ratings.get(l.sellerUid);
    const verifiedSeller = verified.get(l.sellerUid);
    return {
      id: l.id,
      title: l.title,
      category: l.category,
      price: typeof l.price === 'number' ? l.price : Number(l.price) || 0,
      currency: /^[A-Z]{3}$/.test(l.currency || '') ? l.currency : 'ZAR',
      condition: l.condition,
      seller: {
        uid: l.sellerUid,
        name: verifiedSeller?.companyName || l.sellerName || 'Seller',
        type: l.sellerType,
        rating: r ? Math.round(r.avg * 10) / 10 : 0,
        reviewCount: r ? r.count : 0,
        isVerifiedCompany: !!verifiedSeller,
      },
      image: l.imageUrl || PLACEHOLDER_IMAGE,
      hasPhoto: !!l.imageUrl,
      description: l.description || '',
      inStock: l.inStock !== false,
      partNumbers: Array.isArray(l.partNumbers) ? l.partNumbers : [],
      fits: Array.isArray(l.fits) ? l.fits : [],
      keywords: Array.isArray(l.keywords) ? l.keywords : [],
      town: l.town || '',
      province: l.province || '',
      country: l.country || '',
      shipsTo: Array.isArray(l.shipsTo) ? l.shipsTo : [],
      lat: typeof l.lat === 'number' ? l.lat : null,
      lng: typeof l.lng === 'number' ? l.lng : null,
      businessId: l.businessId || '',
      isNew: isNewCondition(l.condition),
      group: groupOfCategory(l.category),
    };
  });
  state = { ...state, listings };
}

function emit() {
  listeners.forEach(l => l());
}

function start() {
  if (!isFirebaseConfigured || stopAll) return;
  const unsubs = [
    subscribeActiveListings(
      l => {
        rawListings = l;
        state = { ...state, loaded: true, error: null };
        rebuild();
        emit();
      },
      e => {
        state = { ...state, loaded: true, error: (e as any)?.message || 'Could not load listings.' };
        emit();
      }
    ),
    subscribeVerifiedSellers(m => {
      verified = m;
      rebuild();
      emit();
    }),
    subscribeReviews(r => {
      reviews = r;
      rebuild();
      emit();
    }),
  ];
  stopAll = () => unsubs.forEach(u => u());
}

function stop() {
  stopAll?.();
  stopAll = null;
}

export function getListings(): ListingItem[] {
  return state.listings;
}

export function getMarketplaceState(): MarketplaceState {
  return state;
}

export function subscribeListings(listener: () => void) {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

/** React hook: live list of active marketplace listings (empty when none / not configured). */
export function useMarketplaceListings(): ListingItem[] {
  return useSyncExternalStore(subscribeListings, getListings, getListings);
}

/** React hook: listings plus loading / configuration / error state. */
export function useMarketplaceState(): MarketplaceState {
  return useSyncExternalStore(subscribeListings, getMarketplaceState, getMarketplaceState);
}

const FOCUS_LISTING_KEY = 'diyelectronics_marketplace_focus_listing';

/**
 * Ask Marketplace to scroll to / highlight a listing the next time it mounts.
 * Used by the Home stories viewer's "View item" button.
 */
export function requestListingFocus(id: string) {
  try {
    sessionStorage.setItem(FOCUS_LISTING_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Reads and clears the pending focus request (if any). */
export function consumeListingFocus(): string | null {
  try {
    const id = sessionStorage.getItem(FOCUS_LISTING_KEY);
    if (id) sessionStorage.removeItem(FOCUS_LISTING_KEY);
    return id;
  } catch {
    return null;
  }
}
