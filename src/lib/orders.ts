/**
 * Marketplace orders & receipts (buyer checkout inside the Marketplace).
 *
 * Collections (see firestore.rules section 5h–5j):
 *   orders/{orderId}                         the live order (buyer, shop, item, delivery/collect, status)
 *   receipts/{orderId}                       append-only proof of sale: money fields never change after
 *                                            creation; only status moves forward (+ history entry), a
 *                                            payment reference can be added once, admins add notes
 *   shopBankDetails/{shopUid}                the shop's bank details (private: shop, admins, and buyers
 *                                            who placed an order with that shop)
 *   shopBankDetails/{shopUid}/buyers/{uid}   marker written with the buyer's order; unlocks bank details
 *
 * No card numbers, CVV, bank logins or passwords are ever collected or stored. Card payments go
 * through PayPal's own page (guest checkout). Receipts never hold bank details or ID numbers, and
 * the optional customs ID is cleared from the order once it is received / collected or cancelled.
 */
import { useEffect, useState } from 'react';
import {
  Timestamp,
  arrayUnion,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { auditData, auditRef, type Actor, type SellerProfile } from './marketplace';
import { countryName, formatPrice, getShopProfile, haversineKm, hasCoords, intlPhone, shipsToCountry, toE164 } from './partsFinder';
import { MAX_ORDER_QTY } from '../config/orders';

// ---------------------------------------------------------------------------
// Types & labels
// ---------------------------------------------------------------------------

export type PayMethod = 'card' | 'paypal' | 'bank';
export const PAY_METHODS: PayMethod[] = ['card', 'paypal', 'bank'];
export const PAY_LABELS: Record<PayMethod, string> = {
  card: 'Visa / Mastercard card (through PayPal)',
  paypal: 'PayPal',
  bank: 'Bank transfer',
};
export const PAY_SHORT: Record<PayMethod, string> = { card: 'Card (via PayPal)', paypal: 'PayPal', bank: 'Bank transfer' };

export type Fulfilment = 'deliver' | 'collect';
export type OrderStatus = 'placed' | 'accepted' | 'paid' | 'sent' | 'collected' | 'cancelled';
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  placed: 'Placed',
  accepted: 'Accepted',
  paid: 'Paid',
  sent: 'Sent',
  collected: 'Received / collected',
  cancelled: 'Cancelled',
};
/** Forward order of statuses. Must match statusRank() in firestore.rules. */
export const STATUS_RANK: Record<OrderStatus, number> = { placed: 0, accepted: 1, paid: 2, sent: 3, collected: 4, cancelled: 9 };

export interface OrderDoc {
  id: string;
  orderNumber: string;
  buyerUid: string;
  buyerName: string;
  buyerPhone: string;
  shopUid: string;
  shopName: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  qty: number;
  unitPrice: number;
  itemsTotal: number;
  fulfilment: Fulfilment;
  deliveryFee: number;
  total: number;
  currency: string;
  buyerCountry: string;
  lat: number | null;
  lng: number | null;
  addressText: string;
  payment: PayMethod;
  /** Optional customs ID (only for imports into CUSTOMS_ID_COUNTRIES). Cleared when received / collected or cancelled. */
  customsId: string;
  note: string;
  shopNote?: string;
  adminNote?: string;
  status: OrderStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ReceiptItem { listingId: string; title: string; qty: number; unitPrice: number }
export interface StatusEvent { status: OrderStatus; at: Timestamp; by: string }
export interface AdminNote { note: string; by: string; byEmail: string; at: Timestamp }

export interface ReceiptDoc {
  id: string;
  orderId: string;
  orderNumber: string;
  buyerUid: string;
  buyerName: string;
  shopUid: string;
  shopName: string;
  items: ReceiptItem[];
  itemsTotal: number;
  deliveryFee: number;
  total: number;
  currency: string;
  fulfilment: Fulfilment;
  payment: PayMethod;
  paymentRef: string;
  paymentRefBy?: string;
  paymentRefAt?: Timestamp;
  status: OrderStatus;
  statusHistory: StatusEvent[];
  adminNotes: AdminNote[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface BankDetails {
  accountName: string;
  bankName: string;
  accountNumber: string;
  branchCode: string;
  swift: string;
  iban: string;
  extra: string;
}
export const EMPTY_BANK: BankDetails = { accountName: '', bankName: '', accountNumber: '', branchCode: '', swift: '', iban: '', extra: '' };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const round2 = (n: number) => Math.round(n * 100) / 100;

function tsMillis(ts?: Timestamp | null): number {
  return ts && typeof (ts as any).toMillis === 'function' ? ts.toMillis() : 0;
}

export function formatWhen(ts?: Timestamp | null): string {
  if (!ts || typeof (ts as any).toDate !== 'function') return '—';
  return ts.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Human order number, e.g. "DIY-261021-K3F9QZ" (date + start of the order id). */
export function makeOrderNumber(orderId: string, d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `DIY-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${orderId.slice(0, 6).toUpperCase()}`;
}

/** Which payment methods a shop takes (only the ones it has set up). */
export function shopPayMethods(shop: Pick<SellerProfile, 'payMethods' | 'paypalEmail' | 'paypalMe'> | null | undefined): PayMethod[] {
  const list = (shop?.payMethods || []).filter((m): m is PayMethod => PAY_METHODS.includes(m as PayMethod));
  return list.filter(m => (m === 'card' ? !!shop?.paypalEmail : m === 'paypal' ? !!(shop?.paypalEmail || shop?.paypalMe) : true));
}

/** A shop takes orders in the app when it has at least one payment method and is not suspended. */
export function shopTakesOrders(shop: SellerProfile | null | undefined): boolean {
  return !!shop && !!shop.isShop && !shop.suspended && shopPayMethods(shop).length > 0;
}

/** Normalise a PayPal.me link ("paypal.me/name", "@name", "name") to "https://paypal.me/name". */
export function normalisePaypalMe(raw: string): string {
  let s = (raw || '').trim();
  if (!s) return '';
  s = s.replace(/^@/, '').replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  if (/^paypal\.me\//i.test(s)) s = s.slice('paypal.me/'.length);
  s = s.split(/[/?#]/)[0];
  return /^[A-Za-z0-9_.-]{1,60}$/.test(s) ? `https://paypal.me/${s}` : '';
}

/**
 * PayPal payment page for an order. With the shop's PayPal email we use PayPal's standard "Buy Now"
 * page, which also lets buyers pay by Visa / Mastercard without a PayPal account (guest checkout, when
 * the shop allows it in PayPal). Otherwise the shop's PayPal.me link with the amount.
 * No API keys, no server: the payment happens on PayPal's site, straight to the shop.
 */
export function paypalPayUrl(shop: Pick<SellerProfile, 'paypalEmail' | 'paypalMe'>, order: Pick<OrderDoc, 'total' | 'currency' | 'orderNumber' | 'listingTitle'>): string {
  const amount = round2(order.total).toFixed(2);
  if (shop.paypalEmail) {
    const p = new URLSearchParams({
      cmd: '_xclick',
      business: shop.paypalEmail,
      item_name: `${order.listingTitle} (order ${order.orderNumber})`.slice(0, 127),
      item_number: order.orderNumber,
      amount,
      currency_code: order.currency,
      no_shipping: '1',
    });
    return `https://www.paypal.com/cgi-bin/webscr?${p.toString()}`;
  }
  const me = normalisePaypalMe(shop.paypalMe || '');
  return me ? `${me}/${amount}${order.currency}` : '';
}

export function waLink(number: string, text: string): string {
  const d = intlPhone(number);
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : '';
}

export function mapLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** Can this shop deliver to the buyer? Returns null when yes, otherwise a plain reason. */
export function deliveryBlock(
  shop: SellerProfile,
  listingCurrency: string,
  buyerCountry: string,
  pin: { lat: number; lng: number } | null
): string | null {
  if (!shop.delivery) return "This shop doesn't deliver. You can collect it.";
  const shopCur = shop.currency || listingCurrency;
  if (shopCur !== listingCurrency) return `The price is in ${listingCurrency} but the shop's delivery fee is in ${shopCur}. Message the shop about delivery, or collect it.`;
  const sameCountry = !buyerCountry || !shop.country || buyerCountry === shop.country;
  if (!sameCountry && !(shop.shipsInternationally && shipsToCountry(shop, buyerCountry))) {
    return `This shop doesn't deliver to ${countryName(buyerCountry)}.`;
  }
  if (sameCountry && shop.deliveryMaxKm && pin && hasCoords(shop)) {
    const km = haversineKm(pin, shop);
    if (km > shop.deliveryMaxKm) return `Your pin is ${Math.round(km)} km from the shop. It delivers up to ${shop.deliveryMaxKm} km.`;
  }
  return null;
}

function requireFirebase() {
  if (!isFirebaseConfigured) throw new Error('The cloud database is not set up in this build.');
}

// ---------------------------------------------------------------------------
// Shop profiles for ordering (not filtered by Business plan: listings stay buyable)
// ---------------------------------------------------------------------------

export function useOrderShops(uids: string[]): Map<string, SellerProfile> {
  const key = [...new Set(uids.filter(Boolean))].sort().join('|');
  const [map, setMap] = useState<Map<string, SellerProfile>>(new Map());
  useEffect(() => {
    let alive = true;
    const list = key ? key.split('|') : [];
    Promise.all(list.map(u => getShopProfile(u))).then(profiles => {
      if (!alive) return;
      const m = new Map<string, SellerProfile>();
      profiles.forEach(p => { if (p && shopTakesOrders(p)) m.set(p.uid, p); });
      setMap(m);
    });
    return () => { alive = false; };
  }, [key]);
  return map;
}

// ---------------------------------------------------------------------------
// Bank details (private)
// ---------------------------------------------------------------------------

function cleanBank(b: BankDetails): BankDetails {
  const t = (v: string, n: number) => (v || '').trim().slice(0, n);
  return {
    accountName: t(b.accountName, 120), bankName: t(b.bankName, 120), accountNumber: t(b.accountNumber, 60),
    branchCode: t(b.branchCode, 40), swift: t(b.swift, 20), iban: t(b.iban, 40), extra: t(b.extra, 300),
  };
}

export function bankDetailsComplete(b: BankDetails): boolean {
  return b.accountName.trim().length > 1 && b.bankName.trim().length > 1 && (b.accountNumber.trim().length > 3 || b.iban.trim().length > 7);
}

export async function saveBankDetails(uid: string, b: BankDetails) {
  requireFirebase();
  const clean = cleanBank(b);
  if (!bankDetailsComplete(clean)) throw new Error('For bank transfer, add the account name, the bank name and the account number (or IBAN).');
  await setDoc(doc(db, 'shopBankDetails', uid), { ...clean, updatedAt: serverTimestamp() });
}

/** Shop owner, admins, or a buyer who has placed an order with this shop. */
export async function getBankDetails(shopUid: string): Promise<BankDetails | null> {
  if (!isFirebaseConfigured) return null;
  const snap = await getDoc(doc(db, 'shopBankDetails', shopUid));
  return snap.exists() ? { ...EMPTY_BANK, ...(snap.data() as Partial<BankDetails>) } : null;
}

// ---------------------------------------------------------------------------
// Place an order (order + receipt + bank marker in ONE batch)
// ---------------------------------------------------------------------------

export interface PlaceOrderInput {
  listing: { id: string; title: string; price: number; currency: string; image: string; sellerUid: string };
  shop: SellerProfile;
  buyer: { uid: string; name: string };
  buyerPhone: string;
  qty: number;
  fulfilment: Fulfilment;
  buyerCountry: string;
  pin: { lat: number; lng: number } | null;
  addressText: string;
  payment: PayMethod;
  customsId: string;
  note: string;
}

export async function placeOrder(input: PlaceOrderInput): Promise<OrderDoc> {
  requireFirebase();
  const { listing, shop, buyer } = input;
  if (buyer.uid === listing.sellerUid) throw new Error("You can't order from your own shop.");
  if (!shopTakesOrders(shop)) throw new Error('This shop is not taking orders in the app yet. Message the shop instead.');
  const qty = Math.round(input.qty);
  if (!(qty >= 1 && qty <= MAX_ORDER_QTY)) throw new Error(`Choose a quantity from 1 to ${MAX_ORDER_QTY}.`);
  if (!shopPayMethods(shop).includes(input.payment)) throw new Error('Choose how you will pay.');
  const phone = toE164(input.buyerPhone);
  if (!phone) throw new Error('Type your phone number with the country code, e.g. +44 7700 900123, so the shop can reach you.');
  const deliver = input.fulfilment === 'deliver';
  if (deliver) {
    const block = deliveryBlock(shop, listing.currency, input.buyerCountry, input.pin);
    if (block) throw new Error(block);
    if (!input.pin) throw new Error('Put the pin on the map where the item must be delivered. Tap "Use my location" or drag the pin.');
  }
  const unitPrice = round2(listing.price);
  const itemsTotal = round2(unitPrice * qty);
  const deliveryFee = deliver ? round2(shop.deliveryFee || 0) : 0;
  const total = round2(itemsTotal + deliveryFee);

  const orderRef = doc(collection(db, 'orders'));
  const orderNumber = makeOrderNumber(orderRef.id);
  const now = Timestamp.now();
  const order: Omit<OrderDoc, 'id' | 'createdAt' | 'updatedAt'> = {
    orderNumber,
    buyerUid: buyer.uid,
    buyerName: (buyer.name || 'Buyer').slice(0, 80),
    buyerPhone: phone,
    shopUid: listing.sellerUid,
    shopName: shop.displayName.slice(0, 80),
    listingId: listing.id,
    listingTitle: listing.title.slice(0, 140),
    listingImage: (listing.image || '').startsWith('https://') ? listing.image.slice(0, 2000) : '',
    qty,
    unitPrice,
    itemsTotal,
    fulfilment: input.fulfilment,
    deliveryFee,
    total,
    currency: listing.currency,
    buyerCountry: /^[A-Z]{2}$/.test(input.buyerCountry) ? input.buyerCountry : '',
    lat: deliver && input.pin ? Math.round(input.pin.lat * 1e6) / 1e6 : null,
    lng: deliver && input.pin ? Math.round(input.pin.lng * 1e6) / 1e6 : null,
    addressText: deliver ? input.addressText.trim().slice(0, 300) : '',
    payment: input.payment,
    customsId: deliver ? input.customsId.trim().slice(0, 40) : '',
    note: input.note.trim().slice(0, 500),
    status: 'placed',
  };
  const receipt: Omit<ReceiptDoc, 'id' | 'createdAt' | 'updatedAt'> = {
    orderId: orderRef.id,
    orderNumber,
    buyerUid: order.buyerUid,
    buyerName: order.buyerName,
    shopUid: order.shopUid,
    shopName: order.shopName,
    items: [{ listingId: listing.id, title: order.listingTitle, qty, unitPrice }],
    itemsTotal,
    deliveryFee,
    total,
    currency: order.currency,
    fulfilment: order.fulfilment,
    payment: order.payment,
    paymentRef: '',
    status: 'placed',
    statusHistory: [{ status: 'placed', at: now, by: buyer.uid }],
    adminNotes: [],
  };
  const batch = writeBatch(db);
  batch.set(orderRef, { ...order, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(doc(db, 'receipts', orderRef.id), { ...receipt, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  if (input.payment === 'bank') {
    batch.set(doc(db, 'shopBankDetails', order.shopUid, 'buyers', buyer.uid), { orderId: orderRef.id, at: serverTimestamp() });
  }
  await batch.commit();
  return { ...order, id: orderRef.id };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function mapOrders(snap: { forEach: (fn: (d: any) => void) => void }): OrderDoc[] {
  const out: OrderDoc[] = [];
  snap.forEach(d => out.push({ ...(d.data() as OrderDoc), id: d.id }));
  return out.sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt));
}

export function subscribeOrders(uid: string, as: 'buyer' | 'shop', cb: (o: OrderDoc[]) => void) {
  if (!isFirebaseConfigured) { cb([]); return () => {}; }
  return onSnapshot(
    query(collection(db, 'orders'), where(as === 'buyer' ? 'buyerUid' : 'shopUid', '==', uid)),
    snap => cb(mapOrders(snap)),
    () => cb([])
  );
}

export function subscribeAllOrders(cb: (o: OrderDoc[]) => void, onError?: (e: unknown) => void) {
  return onSnapshot(query(collection(db, 'orders'), limit(500)), snap => cb(mapOrders(snap)), e => onError?.(e));
}

export function subscribeReceipt(orderId: string, cb: (r: ReceiptDoc | null) => void) {
  if (!isFirebaseConfigured) { cb(null); return () => {}; }
  return onSnapshot(doc(db, 'receipts', orderId), s => cb(s.exists() ? ({ ...(s.data() as ReceiptDoc), id: s.id }) : null), () => cb(null));
}

export function subscribeAllReceipts(cb: (r: Map<string, ReceiptDoc>) => void) {
  return onSnapshot(
    query(collection(db, 'receipts'), limit(500)),
    snap => {
      const m = new Map<string, ReceiptDoc>();
      snap.forEach(d => m.set(d.id, { ...(d.data() as ReceiptDoc), id: d.id }));
      cb(m);
    },
    () => cb(new Map())
  );
}

// ---------------------------------------------------------------------------
// Status changes (order + receipt history in ONE batch)
// ---------------------------------------------------------------------------

/** Which statuses each side may move an order to next. Mirrors the rules. */
export function nextStatuses(order: OrderDoc, as: 'buyer' | 'shop'): OrderStatus[] {
  const s = order.status;
  if (s === 'collected' || s === 'cancelled') return [];
  if (as === 'buyer') {
    if (s === 'placed') return ['cancelled'];
    if (s === 'paid' || s === 'sent') return ['collected'];
    return [];
  }
  const forward: OrderStatus[] = (['accepted', 'paid', 'sent', 'collected'] as OrderStatus[]).filter(n => STATUS_RANK[n] > STATUS_RANK[s]);
  const options = order.fulfilment === 'collect' ? forward.filter(n => n !== 'sent') : forward;
  return s === 'sent' ? options : [...options, 'cancelled'];
}

export async function setOrderStatus(order: OrderDoc, status: OrderStatus, byUid: string, shopNote?: string) {
  requireFirebase();
  const batch = writeBatch(db);
  const clearId = status === 'collected' || status === 'cancelled';
  batch.update(doc(db, 'orders', order.id), {
    status,
    updatedAt: serverTimestamp(),
    ...(clearId ? { customsId: '' } : {}),
    ...(shopNote !== undefined ? { shopNote: shopNote.trim().slice(0, 500) } : {}),
  });
  batch.update(doc(db, 'receipts', order.id), {
    status,
    statusHistory: arrayUnion({ status, at: Timestamp.now(), by: byUid }),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

/** PayPal transaction ID or bank reference. Can be added once, by the buyer or the shop. */
export async function addPaymentRef(orderId: string, ref: string, byUid: string) {
  requireFirebase();
  const clean = ref.trim().replace(/\s+/g, ' ').slice(0, 80);
  if (clean.length < 3) throw new Error('Type the PayPal transaction ID or the bank reference.');
  const batch = writeBatch(db);
  batch.update(doc(db, 'receipts', orderId), { paymentRef: clean, paymentRefBy: byUid, paymentRefAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function adminAddReceiptNote(receipt: ReceiptDoc, note: string, actor: Actor) {
  const clean = note.trim().slice(0, 500);
  if (!clean) throw new Error('Type a note.');
  const batch = writeBatch(db);
  batch.update(doc(db, 'receipts', receipt.id), {
    adminNotes: arrayUnion({ note: clean, by: actor.uid, byEmail: actor.email || '', at: Timestamp.now() }),
    updatedAt: serverTimestamp(),
  });
  batch.set(auditRef(), auditData(actor, 'receipt.note', 'receipt', receipt.id, receipt.orderNumber, clean));
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Printable receipt (no bank details, no ID numbers)
// ---------------------------------------------------------------------------

const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function receiptHtml(r: ReceiptDoc): string {
  const money = (n: number) => esc(formatPrice(n, r.currency));
  const rows = r.items.map(i => `<tr><td>${esc(i.title)}</td><td class="n">${i.qty}</td><td class="n">${money(i.unitPrice)}</td><td class="n">${money(round2(i.qty * i.unitPrice))}</td></tr>`).join('');
  const hist = (r.statusHistory || []).map(h => `<li>${esc(ORDER_STATUS_LABELS[h.status] || h.status)} · ${esc(formatWhen(h.at))}</li>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(r.orderNumber)}</title>
<style>body{font:14px/1.5 system-ui,sans-serif;color:#0f172a;max-width:640px;margin:24px auto;padding:0 16px}h1{font-size:20px;margin:0}
table{width:100%;border-collapse:collapse;margin:12px 0}td,th{padding:6px 4px;border-bottom:1px solid #e2e8f0;text-align:left}.n{text-align:right}
.muted{color:#64748b;font-size:12px}.tot td{font-weight:700;border-bottom:none}ul{padding-left:18px;margin:4px 0}</style></head><body>
<h1>DIY Electronics · Receipt</h1>
<p class="muted">Order ${esc(r.orderNumber)} · ${esc(formatWhen(r.createdAt))}</p>
<p><b>Shop:</b> ${esc(r.shopName)} <span class="muted">(ID ${esc(r.shopUid)})</span><br><b>Buyer:</b> ${esc(r.buyerName)} <span class="muted">(ID ${esc(r.buyerUid)})</span></p>
<table><thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Price</th><th class="n">Amount</th></tr></thead><tbody>${rows}
<tr><td colspan="3">${r.fulfilment === 'deliver' ? 'Delivery fee' : 'Collected at the shop'}</td><td class="n">${money(r.deliveryFee)}</td></tr>
<tr class="tot"><td colspan="3">Total (${esc(r.currency)})</td><td class="n">${money(r.total)}</td></tr></tbody></table>
<p><b>Payment:</b> ${esc(PAY_SHORT[r.payment] || r.payment)}<br><b>Payment reference:</b> ${r.paymentRef ? esc(r.paymentRef) : '<span class="muted">not added yet</span>'}<br><b>Status:</b> ${esc(ORDER_STATUS_LABELS[r.status] || r.status)}</p>
<p><b>Status history</b></p><ul>${hist}</ul>
<p class="muted">Payment was made directly to the shop (PayPal or bank). DIY Electronics never sees or stores card numbers. This receipt cannot be edited after the order is placed.</p>
<script>window.onload=function(){window.print()}</script></body></html>`;
}

export function printReceipt(r: ReceiptDoc) {
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) throw new Error('Your browser blocked the print window. Allow pop-ups for this site and try again.');
  w.document.open();
  w.document.write(receiptHtml(r));
  w.document.close();
}
