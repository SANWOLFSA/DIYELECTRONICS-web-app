/**
 * Spare-parts & tools finder (built on the Marketplace).
 *
 * Shops are seller profiles (sellers/{uid} with isShop: true) and the parts / tools they stock are
 * ordinary Marketplace listings carrying a few extra fields (partNumbers, fits, keywords, town,
 * province, country, lat, lng, businessId). Works in any country. This module holds the shared helpers:
 *   - part-number normalisation + the searchable keywords array saved on each listing
 *   - matching repair text (AI answers, circuit-map suspects, guides) against listings
 *   - distance (haversine), the visitor's location / country / region, and OpenStreetMap geocoding
 *   - countries, currencies and international (E.164) phone numbers
 *   - Google Maps directions, WhatsApp and phone links
 *   - a small cache of public shop profiles (contact details for the "Where to buy" panel)
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import type { SellerProfile } from './marketplace';

// ---------------------------------------------------------------------------
// Categories: what counts as a part and what counts as a tool
// ---------------------------------------------------------------------------

export const TOOL_CATEGORIES = ['Test Equipment', 'Soldering Stations', 'Tools', 'Consumables'];
export const PART_CATEGORIES = ['Spare Parts', 'Donor Boards & Parts', 'Boards (Main / PSU / T-con)', 'Screens & Panels', 'Used Devices'];

export type ListingGroup = 'parts' | 'tools' | 'other';
export function groupOfCategory(category: string): ListingGroup {
  if (TOOL_CATEGORIES.includes(category)) return 'tools';
  if (PART_CATEGORIES.includes(category)) return 'parts';
  return 'other';
}

/** "New" is new; every other condition (Like New, Refurbished, Tested Working, For Parts) is used / salvage. */
export function isNewCondition(condition: string): boolean {
  return /^new\b/i.test((condition || '').trim()) && !/like new/i.test(condition || '');
}

// ---------------------------------------------------------------------------
// Countries & currencies (worldwide)
// ---------------------------------------------------------------------------

const COUNTRY_CODES = 'AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HK HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG KP MK NO OM PK PW PS PA PG PY PE PH PL PT PR QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA KR SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW'.split(' ');

let countryNames: Intl.DisplayNames | null = null;
try { countryNames = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { countryNames = null; }

/** "ZA" -> "South Africa" (falls back to the code). */
export function countryName(code: string): string {
  if (!code) return '';
  try { return countryNames?.of(code.toUpperCase()) || code; } catch { return code; }
}

/** Every country as { code, name }, sorted by name. */
export const COUNTRIES: { code: string; name: string }[] = COUNTRY_CODES.map(code => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));

/** Best guess of the visitor's country from the browser language (en-GB -> GB), or ''. */
export function guessCountry(): string {
  try {
    for (const lang of navigator.languages || [navigator.language]) {
      const m = /-([A-Z]{2})\b/i.exec(lang || '');
      if (m && COUNTRY_CODES.includes(m[1].toUpperCase())) return m[1].toUpperCase();
    }
  } catch { /* ignore */ }
  return '';
}

/** Common currencies (any ISO 4217 code is accepted by the rules). */
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'ZAR', 'NGN', 'KES', 'GHS', 'INR', 'PKR', 'BDT', 'PHP', 'IDR', 'BRL', 'MXN', 'CAD', 'AUD', 'NZD', 'JPY', 'CNY', 'AED', 'SAR', 'EGP', 'TZS', 'UGX', 'ZMW', 'BWP', 'NAD', 'MZN', 'ZWL', 'TRY', 'PLN', 'RUB', 'MYR', 'SGD', 'THB', 'VND', 'KRW', 'CHF', 'SEK', 'NOK', 'DKK'];

const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD', GB: 'GBP', ZA: 'ZAR', NG: 'NGN', KE: 'KES', GH: 'GHS', IN: 'INR', PK: 'PKR', BD: 'BDT', PH: 'PHP', ID: 'IDR', BR: 'BRL', MX: 'MXN',
  CA: 'CAD', AU: 'AUD', NZ: 'NZD', JP: 'JPY', CN: 'CNY', AE: 'AED', SA: 'SAR', EG: 'EGP', TZ: 'TZS', UG: 'UGX', ZM: 'ZMW', BW: 'BWP', NA: 'NAD',
  MZ: 'MZN', TR: 'TRY', PL: 'PLN', RU: 'RUB', MY: 'MYR', SG: 'SGD', TH: 'THB', VN: 'VND', KR: 'KRW', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR', PT: 'EUR', IE: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR',
};

/** Default currency for a country code ('' -> USD). */
export function currencyForCountry(code: string): string {
  return COUNTRY_CURRENCY[(code || '').toUpperCase()] || 'USD';
}

/** "1 850,00 R" / "$12.50" in the visitor's locale, for any ISO currency. */
export function formatPrice(amount: number, currency = 'USD'): string {
  const cur = /^[A-Z]{3}$/.test(currency || '') ? currency : 'USD';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: amount % 1 === 0 ? 0 : 2 }).format(amount);
  } catch {
    return `${cur} ${amount.toFixed(2)}`;
  }
}

/** Examples of business registers, for the registration-number hint. */
export const REGISTRATION_HINT = 'e.g. CIPC number (South Africa), Companies House number (UK), EIN (US), CAC number (Nigeria), GSTIN (India)';

// ---------------------------------------------------------------------------
// International phone numbers (E.164)
// ---------------------------------------------------------------------------

/** "+44 7700 900123" -> "+447700900123"; returns '' when it is not a valid E.164 number. */
export function toE164(raw: string): string {
  const t = (raw || '').trim();
  if (!t) return '';
  let d = t.replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = `+${d.slice(2)}`;
  return /^\+[1-9]\d{6,14}$/.test(d) ? d : '';
}

export const PHONE_HELP = 'International format with the country code, e.g. +27 82 123 4567, +44 7700 900123 or +1 555 123 4567.';

// ---------------------------------------------------------------------------
// Normalisation & keywords
// ---------------------------------------------------------------------------

/** Lower-case, letters and digits only: "6870C-0442B" -> "6870c0442b", "470uF 25V" -> "470uf25v". */
export function compact(s: string): string {
  return (s || '').toLowerCase().replace(/[µμ]/g, 'u').replace(/Ω/g, 'ohm').replace(/[^a-z0-9]+/g, '');
}

/** Splits "C12, 470uF 25V; T-con 6870C-0442B" into clean entries. */
export function splitList(raw: string, max = 20, maxLen = 60): string[] {
  const out: string[] = [];
  for (const part of (raw || '').split(/[,;\n]+/)) {
    const v = part.trim().replace(/\s+/g, ' ').slice(0, maxLen);
    if (v && !out.some(o => o.toLowerCase() === v.toLowerCase())) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

function words(s: string): string[] {
  return (s || '').toLowerCase().replace(/[µμ]/g, 'u').split(/[^a-z0-9.\-/]+/).map(w => w.replace(/^[.\-/]+|[.\-/]+$/g, '')).filter(Boolean);
}

/** The searchable keywords array saved on a listing (lower-case words + compact part numbers). */
export function buildKeywords(input: { title: string; category: string; partNumbers: string[]; fits: string[]; condition?: string }): string[] {
  const set = new Set<string>();
  const add = (w: string) => { const c = w.trim().toLowerCase(); if (c.length >= 2 && c.length <= 60) set.add(c); };
  for (const w of words(`${input.title} ${input.category} ${input.fits.join(' ')}`)) add(w);
  for (const pn of input.partNumbers) { add(compact(pn)); for (const w of words(pn)) add(w); }
  for (const f of input.fits) add(compact(f));
  if (input.condition) add(isNewCondition(input.condition) ? 'new' : 'used');
  return [...set].slice(0, 80);
}

/** Every 1-4 word run of the text, compacted (so "470 uF 25 V" and "6870C-0442B" both match). */
function textGrams(text: string): Set<string> {
  const toks = (text || '').toLowerCase().replace(/[µμ]/g, 'u').split(/[\s,;:()[\]{}"'`*_|!?<>=+]+/).map(compact).filter(Boolean).slice(0, 6000);
  const grams = new Set<string>();
  for (let i = 0; i < toks.length; i++) {
    let g = '';
    for (let n = 0; n < 4 && i + n < toks.length; n++) {
      g += toks[i + n];
      if (g.length <= 40) grams.add(g);
    }
  }
  return grams;
}

/** Does a free-text search match a listing (title, description, part numbers, models it fits…)? */
export function listingMatchesQuery(item: { title: string; description: string; category: string; seller: { name: string }; partNumbers?: string[]; fits?: string[]; keywords?: string[]; town?: string }, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const hay = [item.title, item.description, item.category, item.seller.name, item.town || '', ...(item.partNumbers || []), ...(item.fits || []), ...(item.keywords || [])].join(' ').toLowerCase();
  if (hay.includes(query)) return true;
  const hayCompact = compact(hay);
  const terms = query.split(/\s+/).filter(Boolean);
  if (terms.every(t => hay.includes(t) || (compact(t).length >= 2 && hayCompact.includes(compact(t))))) return true;
  const qc = compact(query);
  return qc.length >= 3 && hayCompact.includes(qc);
}

export interface PartMatch<T> { item: T; matched: string; strong: boolean }

/**
 * Listings whose part numbers / aliases appear in a block of repair text. Aliases with a digit
 * ("C12", "470uF 25V", "6870C-0442B") are strong matches; plain words ("T-con", "multimeter") need 4+ letters.
 */
export function matchListingsInText<T extends { partNumbers?: string[]; fits?: string[] }>(text: string, items: T[]): PartMatch<T>[] {
  if (!text || !items.length) return [];
  const grams = textGrams(text);
  const out: PartMatch<T>[] = [];
  for (const item of items) {
    let best: { matched: string; strong: boolean } | null = null;
    for (const pn of item.partNumbers || []) {
      const c = compact(pn);
      const strong = /\d/.test(c);
      if (c.length < (strong ? 2 : 4) || !grams.has(c)) continue;
      if (!best || (strong && !best.strong) || (strong === best.strong && c.length > compact(best.matched).length)) best = { matched: pn, strong };
    }
    if (best) out.push({ item, ...best });
  }
  return out.sort((a, b) => Number(b.strong) - Number(a.strong));
}

/** Does this text ask the user to take a measurement (so we offer "No multimeter? Find one nearby")? */
export function asksForMeasurement(text: string): boolean {
  return /\b(multi-?meter|measure|measuring|measurement|continuity|ohms?|resistance|diode mode|dc volts?|ac volts?|voltage reading|esr|probes?)\b|Ω/i.test(text || '');
}

// ---------------------------------------------------------------------------
// Distance & links
// ---------------------------------------------------------------------------

export interface LatLng { lat: number; lng: number }

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function hasCoords(x: { lat?: number | null; lng?: number | null } | null | undefined): x is LatLng {
  return !!x && typeof x.lat === 'number' && typeof x.lng === 'number' && Number.isFinite(x.lat) && Number.isFinite(x.lng) && !(x.lat === 0 && x.lng === 0);
}

export function formatKm(km: number): string {
  if (km < 1) return `${Math.max(100, Math.round(km * 10) * 100)} m`;
  return km < 20 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** Google Maps directions to a shop (coordinates when we have them, otherwise the address). */
export function directionsUrl(dest: { lat?: number | null; lng?: number | null; address?: string; town?: string; province?: string; country?: string; name?: string }): string {
  const destination = hasCoords(dest) ? `${dest.lat},${dest.lng}` : [dest.name, dest.address, dest.town, dest.province, dest.country ? countryName(dest.country) : ''].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** Digits only for wa.me / tel: ("+44 7700 900123" -> "447700900123"). Numbers are stored in E.164. */
export function intlPhone(raw: string): string {
  let d = (raw || '').replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  return d.replace(/\D/g, '');
}

export function whatsappUrl(number: string, partName: string): string {
  const text = `Hi, I saw on DIY Electronics you have ${partName}. Is it still available, and what is the price?`;
  return `https://wa.me/${intlPhone(number)}?text=${encodeURIComponent(text)}`;
}

export function telUrl(number: string): string {
  const d = intlPhone(number);
  return d ? `tel:+${d}` : '';
}

/** OpenStreetMap embed (no API key) centred on a point, with a marker. */
export function osmEmbedUrl(p: LatLng): string {
  const d = 0.006;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${p.lng - d}%2C${p.lat - d}%2C${p.lng + d}%2C${p.lat + d}&layer=mapnik&marker=${p.lat}%2C${p.lng}`;
}

/** Free OpenStreetMap (Nominatim) address lookup. Light use only: one request per button press. */
export async function geocodeAddress(address: string, country = ''): Promise<(LatLng & { label: string }) | null> {
  const q = address.trim();
  if (q.length < 4) return null;
  const cc = /^[A-Z]{2}$/i.test(country) ? `&countrycodes=${country.toLowerCase()}` : '';
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1${cc}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('The map lookup is busy. Try again in a minute, or use "Use my current location".');
  const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  if (!data?.length) return null;
  return { lat: Number(data[0].lat), lng: Number(data[0].lon), label: data[0].display_name };
}

export function currentPosition(timeoutMs = 12000): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('This browser cannot share its location.'));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: Math.round(p.coords.latitude * 1e5) / 1e5, lng: Math.round(p.coords.longitude * 1e5) / 1e5 }),
      e => reject(new Error(e.code === 1 ? 'Location permission was refused. Allow location for this site, or choose your country and area instead.' : 'Could not get your location. Choose your country and area instead.')),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 10 * 60 * 1000 }
    );
  });
}

// ---------------------------------------------------------------------------
// The visitor's location (for "nearest first"), shared across pages
// ---------------------------------------------------------------------------

const LOC_KEY = 'diy_parts_user_loc';
const AREA_KEY = 'diy_parts_user_area';

/** Where the visitor is: GPS coordinates when shared, otherwise a country (ISO code) and an area (town / region). */
export interface UserLocation { coords: LatLng | null; country: string; region: string }

function readLocation(): UserLocation {
  let coords: LatLng | null = null;
  let country = '';
  let region = '';
  try {
    const raw = sessionStorage.getItem(LOC_KEY);
    if (raw) { const p = JSON.parse(raw); if (hasCoords(p)) coords = { lat: p.lat, lng: p.lng }; }
    const area = JSON.parse(localStorage.getItem(AREA_KEY) || '{}');
    country = typeof area.country === 'string' ? area.country : '';
    region = typeof area.region === 'string' ? area.region : '';
  } catch { /* ignore */ }
  if (!country && typeof navigator !== 'undefined') country = guessCountry();
  return { coords, country, region };
}

let userLoc: UserLocation = typeof window !== 'undefined' ? readLocation() : { coords: null, country: '', region: '' };
const locListeners = new Set<() => void>();
const emitLoc = () => locListeners.forEach(l => l());

export function setUserCoords(coords: LatLng | null) {
  userLoc = { ...userLoc, coords };
  try { if (coords) sessionStorage.setItem(LOC_KEY, JSON.stringify(coords)); else sessionStorage.removeItem(LOC_KEY); } catch { /* ignore */ }
  emitLoc();
}

export function setUserArea(area: { country?: string; region?: string }) {
  userLoc = { ...userLoc, ...area };
  try { localStorage.setItem(AREA_KEY, JSON.stringify({ country: userLoc.country, region: userLoc.region })); } catch { /* ignore */ }
  emitLoc();
}

/** Asks the browser for the visitor's position and remembers it for this session. */
export async function locateUser(): Promise<LatLng> {
  const p = await currentPosition();
  setUserCoords(p);
  return p;
}

export function useUserLocation(): UserLocation {
  return useSyncExternalStore(
    cb => { locListeners.add(cb); return () => locListeners.delete(cb); },
    () => userLoc,
    () => userLoc
  );
}

/** Does this listing / shop ship to a country (ISO code)? */
export function shipsToCountry(item: { shipsTo?: string[] }, country: string): boolean {
  const list = item.shipsTo || [];
  return list.includes('WORLDWIDE') || (!!country && list.includes(country));
}

/**
 * Sort key for "nearest first": verified first, then local shops by distance (or same country, then
 * same town / region), then overseas suppliers that ship to the visitor's country, then price.
 */
export function rankNearest<T extends { price: number; town?: string; province?: string; country?: string; shipsTo?: string[]; lat?: number | null; lng?: number | null; seller: { isVerifiedCompany: boolean } }>(
  items: T[],
  loc: UserLocation,
  opts: { verifiedFirst?: boolean } = {}
): { item: T; km: number | null }[] {
  // Distance only means something for shops you could visit: skip it for overseas shippers.
  const local = (it: T) => !loc.country || !it.country || it.country === loc.country || !shipsToCountry(it, loc.country);
  const withKm = items.map(item => ({ item, km: loc.coords && hasCoords(item) && local(item) ? haversineKm(loc.coords, item) : null }));
  const region = (loc.region || '').trim().toLowerCase();
  const regionScore = (it: T) => {
    let score = 0;
    if (loc.country && it.country && it.country !== loc.country) score += shipsToCountry(it, loc.country) ? 2 : 4;
    if (region && !(`${it.town || ''} ${it.province || ''}`.toLowerCase().includes(region))) score += 1;
    return score;
  };
  return withKm.sort((a, b) => {
    if (opts.verifiedFirst !== false) {
      const v = Number(b.item.seller.isVerifiedCompany) - Number(a.item.seller.isVerifiedCompany);
      if (v) return v;
    }
    // Local first, then overseas suppliers that ship to you, then the rest.
    if (loc.country) {
      const tier = (it: T) => (!it.country || it.country === loc.country ? 0 : shipsToCountry(it, loc.country) ? 1 : 2);
      const t = tier(a.item) - tier(b.item);
      if (t) return t;
    }
    if (a.km !== null || b.km !== null) {
      if (a.km === null) return 1;
      if (b.km === null) return -1;
      if (Math.abs(a.km - b.km) > 0.05) return a.km - b.km;
    } else {
      const r = regionScore(a.item) - regionScore(b.item);
      if (r) return r;
    }
    return a.item.price - b.item.price;
  });
}

// ---------------------------------------------------------------------------
// Public shop profiles (cached getDoc per seller)
// ---------------------------------------------------------------------------

const shopCache = new Map<string, Promise<SellerProfile | null>>();

export function getShopProfile(uid: string): Promise<SellerProfile | null> {
  if (!isFirebaseConfigured || !uid) return Promise.resolve(null);
  let p = shopCache.get(uid);
  if (!p) {
    p = getDoc(doc(db, 'sellers', uid))
      .then(s => (s.exists() ? ({ ...(s.data() as SellerProfile), uid }) : null))
      .catch(() => null);
    shopCache.set(uid, p);
    setTimeout(() => shopCache.delete(uid), 5 * 60 * 1000);
  }
  return p;
}

/** Shop profiles for a set of seller uids (missing / suspended / not-a-shop are left out). */
export function useShopProfiles(uids: string[]): Map<string, SellerProfile> {
  const key = [...new Set(uids)].sort().join('|');
  const [map, setMap] = useState<Map<string, SellerProfile>>(new Map());
  useEffect(() => {
    let alive = true;
    const list = key ? key.split('|') : [];
    Promise.all(list.map(u => getShopProfile(u))).then(profiles => {
      if (!alive) return;
      const m = new Map<string, SellerProfile>();
      // Shops whose Business plan has expired drop out of "Where to buy" (individual sellers are never affected).
      profiles.forEach(p => { if (p && p.isShop && !p.suspended && p.plan !== 'expired') m.set(p.uid, p); });
      setMap(m);
    });
    return () => { alive = false; };
  }, [key]);
  return map;
}

/** Marketplace deep link pre-filtered for a part or tool. */
export function marketplaceLink(opts: { q?: string; group?: ListingGroup; near?: boolean; cond?: 'new' | 'used'; verified?: boolean }): string {
  const p = new URLSearchParams();
  if (opts.q) p.set('q', opts.q);
  if (opts.group && opts.group !== 'other') p.set('group', opts.group);
  if (opts.cond) p.set('cond', opts.cond);
  if (opts.verified) p.set('verified', '1');
  if (opts.near) p.set('near', '1');
  const s = p.toString();
  return `/marketplace${s ? `?${s}` : ''}`;
}
