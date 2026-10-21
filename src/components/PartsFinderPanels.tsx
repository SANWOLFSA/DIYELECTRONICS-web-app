/**
 * "Where to buy" panel and "No multimeter? Find one nearby" card.
 * Both read the live Marketplace listings (parts and tools listed by registered shops) and open the
 * Marketplace pre-filtered. Shown under AI answers, circuit maps, repair guides and component pages.
 */
import { useMemo, useState } from 'react';
import { BadgeCheck, Gauge, LocateFixed, MapPin, MessageCircle, Navigation, Phone, Store, Loader2 } from 'lucide-react';
import { RouteLink } from '../hooks/usePathname';
import { useMarketplaceListings, type ListingItem } from '../lib/marketplaceListings';
import { formatZar, type SellerProfile } from '../lib/marketplace';
import {
  countryName, directionsUrl, formatKm, shipsToCountry, locateUser, marketplaceLink, matchListingsInText, rankNearest, telUrl, useShopProfiles, useUserLocation, whatsappUrl,
} from '../lib/partsFinder';

export function VerifiedShopBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold ${className}`}>
      <BadgeCheck className="w-3 h-3" /> Verified shop
    </span>
  );
}

const actBtn = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors';

/** Directions / WhatsApp / Call buttons for a shop (only the ones the shop filled in). */
export function ShopActions({ shop, partName, compact = false }: { shop: SellerProfile; partName: string; compact?: boolean }) {
  const wa = shop.whatsapp || '';
  const tel = telUrl(shop.phone || '');
  return (
    <div className="flex flex-wrap gap-1.5">
      <a href={directionsUrl({ ...shop, name: shop.displayName })} target="_blank" rel="noopener noreferrer" className={`${actBtn} bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700`}>
        <Navigation className="w-3.5 h-3.5" /> {compact ? 'Map' : 'Directions'}
      </a>
      {wa && (
        <a href={whatsappUrl(wa, partName)} target="_blank" rel="noopener noreferrer" className={`${actBtn} bg-emerald-600 text-white hover:bg-emerald-700`}>
          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
        </a>
      )}
      {tel && (
        <a href={tel} className={`${actBtn} bg-cobalt-600 text-white hover:bg-cobalt-700`}>
          <Phone className="w-3.5 h-3.5" /> Call
        </a>
      )}
    </div>
  );
}

/** "Use my location" button (distance + nearest first). */
export function UseMyLocationButton({ className = '' }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <button type="button" disabled={busy} onClick={async () => { setBusy(true); setErr(''); try { await locateUser(); } catch (e: any) { setErr(e?.message || 'Could not get your location.'); } finally { setBusy(false); } }}
        className="inline-flex items-center gap-1 text-[11px] font-bold text-cobalt-600 dark:text-cobalt-300 hover:underline disabled:opacity-50">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />} Use my location
      </button>
      {err && <span className="text-[10px] text-rose-600">{err}</span>}
    </span>
  );
}

/**
 * Nearest shops that stock a part mentioned in `text`. Renders nothing when no shop lists a matching
 * part number, so it never adds noise.
 */
export function WhereToBuy({ text, className = '', max = 3 }: { text: string; className?: string; max?: number }) {
  const listings = useMarketplaceListings();
  const loc = useUserLocation();
  const matches = useMemo(() => {
    const shopItems = listings.filter(l => l.businessId && l.inStock);
    return matchListingsInText(text, shopItems);
  }, [listings, text]);
  const ranked = useMemo(() => {
    const strongFirst = matches.some(m => m.strong) ? matches.filter(m => m.strong) : matches;
    const byId = new Map(strongFirst.map(m => [m.item.id, m.matched]));
    return rankNearest(strongFirst.map(m => m.item), loc).map(r => ({ ...r, matched: byId.get(r.item.id) || r.item.title }));
  }, [matches, loc]);
  const shops = useShopProfiles(ranked.slice(0, 12).map(r => r.item.seller.uid));
  const visible = ranked.filter(r => shops.has(r.item.seller.uid)).slice(0, max);
  if (!visible.length) return null;
  const firstPart = visible[0].matched;

  return (
    <div className={`rounded-2xl border border-cobalt-200 dark:border-cobalt-500/30 bg-cobalt-50/50 dark:bg-cobalt-500/5 p-3 space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5"><Store className="w-4 h-4 text-cobalt-600" /> Where to buy</h4>
        {!loc.coords && <UseMyLocationButton />}
      </div>
      <div className="space-y-2">
        {visible.map(({ item, km, matched }) => (
          <WhereToBuyRow key={item.id} item={item} km={km} shop={shops.get(item.seller.uid)!} part={matched} region={loc.region} country={loc.country} />
        ))}
      </div>
      <RouteLink to={marketplaceLink({ q: firstPart, near: true })} className="inline-block text-[11px] font-bold text-cobalt-600 dark:text-cobalt-300 hover:underline">
        See all shops with {firstPart} in the Marketplace →
      </RouteLink>
    </div>
  );
}

function WhereToBuyRow({ item, km, shop, part, region, country }: { item: ListingItem; km: number | null; shop: SellerProfile; part: string; region: string; country: string }) {
  const overseas = !!country && !!item.country && item.country !== country && shipsToCountry(item, country);
  const where = overseas ? `Ships to you from ${countryName(item.country)}` : km !== null ? formatKm(km) : [item.town, item.province, item.country && item.country !== country ? countryName(item.country) : ''].filter(Boolean).join(', ');
  const nearYou = km === null && !!region && `${item.town} ${item.province}`.toLowerCase().includes(region.trim().toLowerCase());
  return (
    <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
            <span className="truncate">{shop.displayName}</span>
            {item.seller.isVerifiedCompany && <VerifiedShopBadge />}
          </p>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1">{item.title}</p>
          <p className="text-[10px] text-slate-500 flex items-center gap-1 flex-wrap">
            <span className={`px-1.5 rounded ${item.isNew ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'} font-bold`}>{item.isNew ? 'New' : 'Used'}</span>
            {where && <span className="inline-flex items-center gap-0.5"><MapPin className="w-3 h-3" />{where}{nearYou ? ' (your area)' : ''}</span>}
          </p>
        </div>
        <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-50 shrink-0">{formatZar(item.price, item.currency)}</span>
      </div>
      <ShopActions shop={shop} partName={part || item.title} compact />
    </div>
  );
}

/** "No multimeter? Find one nearby" with a one-line beginner tip. */
export function NoMultimeterCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/5 p-3 flex items-start gap-2.5 ${className}`}>
      <Gauge className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="min-w-0 space-y-1">
        <RouteLink to={marketplaceLink({ q: 'multimeter', group: 'tools', near: true })} className="text-xs font-bold text-amber-800 dark:text-amber-200 hover:underline">
          No multimeter? Find one nearby →
        </RouteLink>
        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
          Tip: a basic digital multimeter with a continuity beep is enough for most repairs. <RouteLink to="/multimeter" className="font-bold text-amber-700 dark:text-amber-300 hover:underline">Learn how to use it</RouteLink>
        </p>
      </div>
    </div>
  );
}
