/**
 * Buyer ordering inside the Marketplace: order form (deliver / collect, map pin, payment choice),
 * "My orders" and "Orders for my shop", receipts (view / print), and the Admin Desk orders view.
 * No card details are ever typed into the app: card and PayPal payments open PayPal's own page.
 */
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Banknote, CheckCircle2, CreditCard, ExternalLink, Inbox, Landmark, Loader2, LocateFixed, MapPin, MessageCircle,
  Minus, Navigation, Phone, Plus, Printer, Receipt, Search, ShoppingBag, Store, Truck, X,
} from 'lucide-react';
import type { ListingItem } from '../lib/marketplaceListings';
import type { Actor, SellerProfile } from '../lib/marketplace';
import { friendlyError } from '../lib/marketplace';
import {
  COUNTRIES, countryName, currentPosition, directionsUrl, formatKm, formatPrice, geocodeAddress, getShopProfile, guessCountry, hasCoords, haversineKm, telUrl, useUserLocation,
} from '../lib/partsFinder';
import {
  ORDER_STATUS_LABELS, PAY_LABELS, PAY_SHORT, addPaymentRef, adminAddReceiptNote, deliveryBlock, formatWhen, getBankDetails, mapLink, nextStatuses,
  paypalPayUrl, placeOrder, printReceipt, setOrderStatus, shopPayMethods, subscribeAllOrders, subscribeAllReceipts, subscribeOrders, subscribeReceipt, waLink,
  type BankDetails, type Fulfilment, type OrderDoc, type OrderStatus, type PayMethod, type ReceiptDoc,
} from '../lib/orders';
import { MAX_ORDER_QTY, customsIdFor } from '../config/orders';

const PinPickerMap = lazy(() => import('./PinPickerMap'));

// ---------------------------------------------------------------------------
// Shared styling (same look as Marketplace.tsx)
// ---------------------------------------------------------------------------

const inputCls =
  'w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60';
const labelCls = 'block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1';
const cardCls = 'bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm shadow-slate-200/50 dark:shadow-none';
const ghostBtn =
  'px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-colors disabled:opacity-50 inline-flex items-center gap-1.5';
const actBtn = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors';

const ORDER_STATUS_STYLE: Record<OrderStatus, string> = {
  placed: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  accepted: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  paid: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300',
  sent: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300',
  collected: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const PAY_ICON: Record<PayMethod, any> = { card: CreditCard, paypal: Banknote, bank: Landmark };

function Modal({ onClose, children, wide }: { onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-7 shadow-2xl`} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 z-10">
          <X className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

function ErrorNote({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{msg}</span>
    </div>
  );
}

function StatusChip({ status }: { status: OrderStatus }) {
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${ORDER_STATUS_STYLE[status]}`}>{ORDER_STATUS_LABELS[status]}</span>;
}

const PHONE_KEY = 'diy_buyer_phone';
function rememberedPhone(): string {
  try { return localStorage.getItem(PHONE_KEY) || ''; } catch { return ''; }
}

// ---------------------------------------------------------------------------
// Order form ("Buy")
// ---------------------------------------------------------------------------

export function OrderModal({
  item,
  shop,
  buyer,
  onClose,
  onViewOrders,
  primary,
}: {
  item: ListingItem;
  shop: SellerProfile;
  buyer: { uid: string; name: string };
  onClose: () => void;
  onViewOrders: () => void;
  primary: string;
}) {
  const userLoc = useUserLocation();
  const methods = shopPayMethods(shop);
  const [qty, setQty] = useState(1);
  const [buyerCountry, setBuyerCountry] = useState(userLoc.country || guessCountry() || shop.country || '');
  const [fulfilment, setFulfilment] = useState<Fulfilment>(() => (shop.delivery && !deliveryBlock(shop, item.currency, buyerCountry, null) ? 'deliver' : 'collect'));
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(userLoc.coords);
  const [addressText, setAddressText] = useState('');
  const [locating, setLocating] = useState<'gps' | 'address' | null>(null);
  const [pinNote, setPinNote] = useState<string | null>(null);
  const [payment, setPayment] = useState<PayMethod | ''>(methods.length === 1 ? methods[0] : '');
  const [customsId, setCustomsId] = useState('');
  const [phone, setPhone] = useState(rememberedPhone);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [placed, setPlaced] = useState<OrderDoc | null>(null);

  const deliver = fulfilment === 'deliver';
  const block = deliveryBlock(shop, item.currency, buyerCountry, pin);
  const customs = customsIdFor(buyerCountry, shop.country || '', deliver);
  const deliveryFee = deliver ? shop.deliveryFee || 0 : 0;
  const itemsTotal = Math.round(item.price * qty * 100) / 100;
  const total = Math.round((itemsTotal + deliveryFee) * 100) / 100;
  const km = pin && hasCoords(shop) ? haversineKm(pin, shop) : null;

  const useGps = async () => {
    setLocating('gps'); setPinNote(null);
    try {
      const p = await currentPosition(15000);
      setPin(p);
      setPinNote('Pin set to where your phone is now. Drag it if the delivery spot is somewhere else.');
    } catch (ex: any) { setPinNote(ex?.message || 'Could not get your location. Drag the pin on the map instead.'); }
    finally { setLocating(null); }
  };
  const findTyped = async () => {
    setLocating('address'); setPinNote(null);
    try {
      const r = await geocodeAddress(addressText, buyerCountry);
      if (r) { setPin({ lat: r.lat, lng: r.lng }); setPinNote('Found it. Check the pin and drag it to the exact spot.'); }
      else setPinNote('That address was not found. Tap "Use my location" or drag the pin.');
    } catch (ex: any) { setPinNote(ex?.message || 'The map lookup failed. Drag the pin instead.'); }
    finally { setLocating(null); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment) { setErr('Choose how you will pay.'); return; }
    setBusy(true); setErr(null);
    try {
      const order = await placeOrder({
        listing: { id: item.id, title: item.title, price: item.price, currency: item.currency, image: item.hasPhoto ? item.image : '', sellerUid: item.seller.uid },
        shop, buyer, buyerPhone: phone, qty, fulfilment, buyerCountry, pin: deliver ? pin : null,
        addressText, payment, customsId: customs ? customsId : '', note,
      });
      try { localStorage.setItem(PHONE_KEY, order.buyerPhone); } catch { /* ignore */ }
      setPlaced(order);
    } catch (ex) {
      setErr(friendlyError(ex));
    } finally {
      setBusy(false);
    }
  };

  if (placed) {
    return (
      <Modal onClose={onClose}>
        <div className="space-y-4">
          <div className="text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Order placed</h2>
            <p className="text-xs text-slate-500">Order number <span className="font-mono font-bold text-slate-800 dark:text-slate-100 select-all">{placed.orderNumber}</span> · {formatPrice(placed.total, placed.currency)}</p>
          </div>
          <PayBox order={placed} shop={shop} uid={buyer.uid} primary={primary} />
          <ContactButtons phone={shop.phone || ''} whatsapp={shop.whatsapp || ''} text={`Hi ${shop.displayName}, I placed order ${placed.orderNumber} on DIY Electronics (${placed.listingTitle}).`} />
          <div className="flex justify-end gap-2">
            <button type="button" className={ghostBtn} onClick={onClose}>Close</button>
            <button type="button" className={primary} onClick={onViewOrders}>See my orders</button>
          </div>
        </div>
      </Modal>
    );
  }

  const choice = (value: Fulfilment, title: string, body: string, Icon: any, disabled?: string | null) => (
    <button type="button" disabled={!!disabled} onClick={() => setFulfilment(value)}
      className={`text-left p-3 rounded-2xl border-2 transition-all disabled:opacity-50 ${fulfilment === value ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}>
      <span className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100"><Icon className="w-4 h-4" /> {title}{fulfilment === value && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />}</span>
      <span className="block text-[11px] text-slate-500 mt-1">{disabled || body}</span>
    </button>
  );

  return (
    <Modal onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-5">
        <div className="flex gap-3 pr-8">
          {item.hasPhoto && <img src={item.image} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" referrerPolicy="no-referrer" />}
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Buy</h2>
            <p className="text-xs text-slate-500 line-clamp-2">{item.title} · <span className="font-bold">{formatPrice(item.price, item.currency)}</span> from {shop.displayName}</p>
          </div>
        </div>

        <div>
          <label className={labelCls}>How many?</label>
          <div className="inline-flex items-center gap-2">
            <button type="button" className={ghostBtn} onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="One less"><Minus className="w-3.5 h-3.5" /></button>
            <input type="number" min={1} max={MAX_ORDER_QTY} value={qty} onChange={e => setQty(Math.max(1, Math.min(MAX_ORDER_QTY, Math.round(Number(e.target.value) || 1))))} className={`${inputCls} !w-20 text-center`} aria-label="Quantity" />
            <button type="button" className={ghostBtn} onClick={() => setQty(q => Math.min(MAX_ORDER_QTY, q + 1))} aria-label="One more"><Plus className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        <div className="space-y-2">
          <label className={labelCls}>How do you want to get it?</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {choice('deliver', 'Deliver to me', `Delivery fee ${formatPrice(shop.deliveryFee || 0, shop.currency || item.currency)} (once-off)`, Truck, shop.delivery ? (block && !block.startsWith('Your pin') ? block : null) : "This shop doesn't deliver.")}
            {choice('collect', "I'll collect it", `At the shop in ${[shop.town, countryName(shop.country || '')].filter(Boolean).join(', ')}`, Store)}
          </div>
        </div>

        {deliver ? (
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Your country</label>
                <select value={buyerCountry} onChange={e => setBuyerCountry(e.target.value)} className={inputCls} required>
                  <option value="">Choose your country</option>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button type="button" onClick={useGps} disabled={!!locating} className={`${primary} w-full`}>
                  {locating === 'gps' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />} Use my location
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300"><MapPin className="w-3.5 h-3.5 inline" /> Put the red pin where the item must go: tap "Use my location", or drag the pin, or tap the map.</p>
            <Suspense fallback={<div className="h-64 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-400"><Loader2 className="w-4 h-4 animate-spin mr-1" /> Loading map…</div>}>
              <PinPickerMap value={pin} onChange={p => { setPin(p); setPinNote(null); }} fallbackCenter={hasCoords(shop) ? { lat: shop.lat as number, lng: shop.lng as number } : null} shop={hasCoords(shop) ? { lat: shop.lat as number, lng: shop.lng as number } : null} />
            </Suspense>
            {pinNote && <p className="text-[11px] text-slate-500">{pinNote}</p>}
            {pin && km != null && <p className="text-[11px] text-slate-500">About {formatKm(km)} from the shop (blue square).</p>}
            {block && <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">{block}</p>}
            <div>
              <label className={labelCls}>Address or directions (optional)</label>
              <div className="flex gap-2">
                <input value={addressText} onChange={e => setAddressText(e.target.value)} placeholder="e.g. House 12, blue gate, next to the school" className={inputCls} maxLength={300} />
                <button type="button" onClick={findTyped} disabled={!!locating || addressText.trim().length < 4} className={ghostBtn} title="Find this address on the map">
                  {locating === 'address' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {customs && (
              <div>
                <label className={labelCls}>{customs.label} (optional)</label>
                <input value={customsId} onChange={e => setCustomsId(e.target.value)} className={inputCls} maxLength={40} autoComplete="off" />
                <p className="text-[10px] text-slate-500 mt-1">{customs.hint} Only you, this shop and our admins can see it. It is deleted from the order once you receive it or the order is cancelled.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-700 dark:text-slate-200 space-y-2">
            <p className="flex items-start gap-1.5"><MapPin className="w-4 h-4 shrink-0 text-slate-400" />{[shop.address, shop.town, shop.province, countryName(shop.country || '')].filter(Boolean).join(', ')}</p>
            {shop.hours && <p className="text-[11px] text-slate-500">Open: {shop.hours}</p>}
            <a href={directionsUrl({ ...shop, name: shop.displayName })} target="_blank" rel="noopener noreferrer" className={`${actBtn} bg-slate-200 dark:bg-slate-700`}><Navigation className="w-3.5 h-3.5" /> Directions</a>
          </div>
        )}

        <div className="space-y-2">
          <label className={labelCls}>How will you pay?</label>
          <div className="grid grid-cols-1 gap-2">
            {methods.map(m => {
              const Icon = PAY_ICON[m];
              return (
                <label key={m} className={`flex items-start gap-2 p-3 rounded-2xl border-2 cursor-pointer ${payment === m ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                  <input type="radio" name="pay" checked={payment === m} onChange={() => setPayment(m)} className="mt-0.5 accent-indigo-600" />
                  <span className="text-xs">
                    <span className="font-bold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1"><Icon className="w-4 h-4" /> {PAY_LABELS[m]}</span>
                    <span className="block text-slate-500 mt-0.5">
                      {m === 'card' ? "Pay with Visa or Mastercard on PayPal's secure page. You don't need a PayPal account. You never type your card number into this app."
                        : m === 'paypal' ? 'Pay from your PayPal account straight to the shop.'
                        : "Pay straight into the shop's bank account. You see the bank details after you place the order."}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Your phone number</label>
            <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+<country code> number" className={inputCls} maxLength={30} />
            <p className="text-[10px] text-slate-400 mt-1">With the country code. The shop uses it to WhatsApp or call you.</p>
          </div>
          <div>
            <label className={labelCls}>Message to the shop (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Please call when you arrive" className={inputCls} maxLength={500} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">Item{qty > 1 ? ` × ${qty}` : ''}</span><span className="font-mono">{formatPrice(itemsTotal, item.currency)}</span></div>
          <div className="flex justify-between"><span className="text-slate-600 dark:text-slate-300">Delivery</span><span className="font-mono">{deliver ? formatPrice(deliveryFee, item.currency) : 'Free (you collect)'}</span></div>
          <div className="flex justify-between font-bold text-base pt-1 border-t border-slate-100 dark:border-slate-800"><span>Total</span><span className="font-mono">{formatPrice(total, item.currency)}</span></div>
        </div>

        <p className="text-[11px] text-slate-400">You pay the shop directly. DIY Electronics never sees or keeps card numbers. Only pay when you trust the shop: check its reviews and Verified badge.</p>
        <ErrorNote msg={err} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
          <button type="submit" disabled={busy || !payment || (deliver && (!!block || !pin))} className={primary}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />} Place order · {formatPrice(total, item.currency)}
          </button>
        </div>
        {deliver && !pin && <p className="text-[11px] text-amber-700 dark:text-amber-300 text-right -mt-3">Set the delivery pin on the map first.</p>}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Paying (PayPal / card link, bank details) + payment reference
// ---------------------------------------------------------------------------

function PayBox({ order, shop, uid, primary }: { order: OrderDoc; shop: SellerProfile | null; uid: string; primary: string }) {
  const [bank, setBank] = useState<BankDetails | null | undefined>(undefined);
  const [bankErr, setBankErr] = useState<string | null>(null);
  useEffect(() => {
    if (order.payment !== 'bank') return;
    getBankDetails(order.shopUid).then(setBank).catch(e => { setBank(null); setBankErr(friendlyError(e)); });
  }, [order.payment, order.shopUid]);
  const payUrl = shop && order.payment !== 'bank' ? paypalPayUrl(shop, order) : '';
  return (
    <div className="space-y-3">
      {order.payment === 'bank' ? (
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1.5">
          <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5"><Landmark className="w-4 h-4" /> Pay by bank transfer</p>
          {bank === undefined ? <p className="text-slate-400"><Loader2 className="w-3.5 h-3.5 animate-spin inline" /> Loading bank details…</p>
            : !bank ? <p className="text-amber-700 dark:text-amber-300">{bankErr || 'The shop has not added bank details. Message the shop.'}</p>
            : (
              <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 select-all">
                <span className="text-slate-500">Account name</span><span className="font-bold">{bank.accountName}</span>
                <span className="text-slate-500">Bank</span><span className="font-bold">{bank.bankName}</span>
                {bank.accountNumber && <><span className="text-slate-500">Account number</span><span className="font-mono font-bold">{bank.accountNumber}</span></>}
                {bank.branchCode && <><span className="text-slate-500">Branch / sort / routing</span><span className="font-mono">{bank.branchCode}</span></>}
                {bank.iban && <><span className="text-slate-500">IBAN</span><span className="font-mono">{bank.iban}</span></>}
                {bank.swift && <><span className="text-slate-500">SWIFT / BIC</span><span className="font-mono">{bank.swift}</span></>}
                {bank.extra && <><span className="text-slate-500">Note</span><span>{bank.extra}</span></>}
              </div>
            )}
          <p className="text-slate-600 dark:text-slate-300 pt-1">Amount: <b>{formatPrice(order.total, order.currency)}</b>. Use <b className="font-mono">{order.orderNumber}</b> as the payment reference.</p>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs space-y-2">
          <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">{order.payment === 'card' ? <CreditCard className="w-4 h-4" /> : <Banknote className="w-4 h-4" />} {order.payment === 'card' ? 'Pay by Visa / Mastercard' : 'Pay with PayPal'}</p>
          <p className="text-slate-600 dark:text-slate-300">
            {order.payment === 'card'
              ? 'Tap the button. PayPal opens. Choose "Pay with Debit or Credit Card", type your card on PayPal\'s page, and pay. You do not need a PayPal account.'
              : 'Tap the button. PayPal opens. Log in and pay.'}
          </p>
          {payUrl ? (
            <a href={payUrl} target="_blank" rel="noopener noreferrer" className={primary}><ExternalLink className="w-4 h-4" /> Pay {formatPrice(order.total, order.currency)} on PayPal</a>
          ) : <p className="text-amber-700 dark:text-amber-300">The shop's PayPal link is missing. Message the shop.</p>}
          <p className="text-[10px] text-slate-400">After paying, PayPal shows a transaction ID. Type it below so the shop can match your payment.</p>
        </div>
      )}
      <PaymentRefForm orderId={order.id} uid={uid} placeholder={order.payment === 'bank' ? 'Bank reference from your banking app' : 'PayPal transaction ID, e.g. 8AB12345CD678901E'} primary={primary} />
    </div>
  );
}

function PaymentRefForm({ orderId, uid, placeholder, primary }: { orderId: string; uid: string; placeholder: string; primary: string }) {
  const [receipt, setReceipt] = useState<ReceiptDoc | null | undefined>(undefined);
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => subscribeReceipt(orderId, setReceipt), [orderId]);
  if (receipt === undefined) return null;
  if (receipt?.paymentRef) return <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Payment reference saved: <span className="font-mono">{receipt.paymentRef}</span></p>;
  if (!receipt || receipt.status === 'cancelled') return null;
  return (
    <form className="space-y-1.5" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setErr(null);
      try { await addPaymentRef(orderId, ref, uid); setRef(''); } catch (ex) { setErr(friendlyError(ex)); } finally { setBusy(false); }
    }}>
      <label className={labelCls}>Payment reference</label>
      <div className="flex gap-2">
        <input value={ref} onChange={e => setRef(e.target.value)} placeholder={placeholder} className={inputCls} maxLength={80} />
        <button type="submit" disabled={busy || ref.trim().length < 3} className={primary}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}</button>
      </div>
      <p className="text-[10px] text-slate-400">It goes on the receipt and can't be changed later, so check it first. Never type card numbers or passwords here.</p>
      <ErrorNote msg={err} />
    </form>
  );
}

function ContactButtons({ phone, whatsapp, text }: { phone: string; whatsapp: string; text: string }) {
  const wa = waLink(whatsapp || phone, text);
  const tel = telUrl(phone);
  if (!wa && !tel) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={`${actBtn} bg-emerald-600 text-white hover:bg-emerald-700`}><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</a>}
      {tel && <a href={tel} className={`${actBtn} bg-indigo-600 text-white hover:bg-indigo-700`}><Phone className="w-3.5 h-3.5" /> Call</a>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// My orders / Orders for my shop
// ---------------------------------------------------------------------------

export function OrdersSection({ uid, primary }: { uid: string; primary: string }) {
  const [mine, setMine] = useState<OrderDoc[] | null>(null);
  const [incoming, setIncoming] = useState<OrderDoc[] | null>(null);
  const [receiptFor, setReceiptFor] = useState<string | null>(null);
  useEffect(() => subscribeOrders(uid, 'buyer', setMine), [uid]);
  useEffect(() => subscribeOrders(uid, 'shop', setIncoming), [uid]);
  const [shops, setShops] = useState<Map<string, SellerProfile>>(new Map());
  const shopKey = [...new Set((mine || []).map(o => o.shopUid))].sort().join('|');
  useEffect(() => {
    let alive = true;
    Promise.all((shopKey ? shopKey.split('|') : []).map(getShopProfile)).then(ps => {
      if (!alive) return;
      const m = new Map<string, SellerProfile>();
      ps.forEach(p => p && m.set(p.uid, p));
      setShops(m);
    });
    return () => { alive = false; };
  }, [shopKey]);
  const openIncoming = (incoming || []).filter(o => o.status !== 'collected' && o.status !== 'cancelled').length;

  return (
    <div className="space-y-6">
      {(incoming?.length || 0) > 0 && (
        <section className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Store className="w-3.5 h-3.5" /> Orders for my shop ({openIncoming} open · {incoming!.length} total)</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {incoming!.map(o => <OrderCard key={o.id} order={o} as="shop" uid={uid} shop={null} primary={primary} onReceipt={() => setReceiptFor(o.id)} />)}
          </div>
        </section>
      )}
      <section className="space-y-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5" /> My orders ({mine?.length || 0})</h3>
        {mine === null ? (
          <p className="text-xs text-slate-400"><Loader2 className="w-3.5 h-3.5 animate-spin inline" /> Loading…</p>
        ) : mine.length === 0 ? (
          <div className={`${cardCls} p-6 text-center text-xs text-slate-500 space-y-1`}>
            <Inbox className="w-8 h-8 mx-auto text-indigo-400" />
            <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">No orders yet</p>
            <p>Find an item from a shop in Browse and tap Buy.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {mine.map(o => <OrderCard key={o.id} order={o} as="buyer" uid={uid} shop={shops.get(o.shopUid) || null} primary={primary} onReceipt={() => setReceiptFor(o.id)} />)}
          </div>
        )}
      </section>
      {receiptFor && <ReceiptModal orderId={receiptFor} onClose={() => setReceiptFor(null)} />}
    </div>
  );
}

const STATUS_BUTTON: Record<OrderStatus, string> = {
  placed: 'Placed',
  accepted: 'Accept order',
  paid: 'Mark as paid',
  sent: 'Mark as sent',
  collected: 'Mark as received / collected',
  cancelled: 'Cancel order',
};

function OrderCard({ order, as, uid, shop, primary, onReceipt }: { order: OrderDoc; as: 'buyer' | 'shop'; uid: string; shop: SellerProfile | null; primary: string; onReceipt: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const next = nextStatuses(order, as);
  const open = order.status !== 'collected' && order.status !== 'cancelled';
  const move = async (s: OrderStatus) => {
    setBusy(true); setErr(null);
    try { await setOrderStatus(order, s, uid); setConfirmCancel(false); } catch (ex) { setErr(friendlyError(ex)); } finally { setBusy(false); }
  };
  const buyerLabel = (s: OrderStatus) => (s === 'cancelled' ? 'Cancel order' : s === 'collected' ? 'I got it' : STATUS_BUTTON[s]);
  return (
    <div className={`${cardCls} !rounded-2xl p-4 space-y-2.5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{order.listingTitle}{order.qty > 1 ? ` × ${order.qty}` : ''}</p>
          <p className="text-[11px] text-slate-500"><span className="font-mono">{order.orderNumber}</span> · {formatWhen(order.createdAt)}</p>
          <p className="text-[11px] text-slate-500">{as === 'buyer' ? `From ${order.shopName}` : `Buyer: ${order.buyerName}`}</p>
        </div>
        <div className="text-right space-y-1">
          <StatusChip status={order.status} />
          <p className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">{formatPrice(order.total, order.currency)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 inline-flex items-center gap-1">{order.fulfilment === 'deliver' ? <><Truck className="w-3 h-3" /> Delivery {formatPrice(order.deliveryFee, order.currency)}</> : <><Store className="w-3 h-3" /> Buyer collects</>}</span>
        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{PAY_SHORT[order.payment]}</span>
      </div>
      {as === 'shop' && order.fulfilment === 'deliver' && (
        <div className="text-[11px] text-slate-600 dark:text-slate-300 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 space-y-1">
          <p className="font-bold">Deliver to{order.buyerCountry ? ` (${countryName(order.buyerCountry)})` : ''}:</p>
          {order.addressText && <p>{order.addressText}</p>}
          {order.lat != null && order.lng != null && <a href={mapLink(order.lat, order.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-300"><MapPin className="w-3.5 h-3.5" /> Open the pin in Maps</a>}
          {order.customsId && <p>Customs ID: <span className="font-mono select-all">{order.customsId}</span> <span className="text-slate-400">(deleted when the order is received or cancelled)</span></p>}
        </div>
      )}
      {order.note && <p className="text-xs text-slate-600 dark:text-slate-400">{as === 'shop' ? 'Buyer' : 'You'}: {order.note}</p>}
      {order.shopNote && <p className="text-xs text-indigo-700 dark:text-indigo-300">Shop: {order.shopNote}</p>}

      <div className="flex flex-wrap gap-1.5 items-center">
        {as === 'shop'
          ? <ContactButtons phone={order.buyerPhone} whatsapp={order.buyerPhone} text={`Hi ${order.buyerName}, this is ${order.shopName} about your order ${order.orderNumber} (${order.listingTitle}) on DIY Electronics.`} />
          : shop && <ContactButtons phone={shop.phone || ''} whatsapp={shop.whatsapp || ''} text={`Hi ${order.shopName}, about my order ${order.orderNumber} (${order.listingTitle}) on DIY Electronics.`} />}
        <button type="button" onClick={onReceipt} className={`${actBtn} bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200`}><Receipt className="w-3.5 h-3.5" /> Receipt</button>
        {as === 'buyer' && open && order.status !== 'sent' && (
          <button type="button" onClick={() => setShowPay(v => !v)} className={`${actBtn} bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200`}>{order.payment === 'bank' ? <Landmark className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />} {showPay ? 'Hide payment' : order.payment === 'bank' ? 'Bank details & reference' : 'Pay / add reference'}</button>
        )}
      </div>
      {as === 'buyer' && showPay && <PayBox order={order} shop={shop} uid={uid} primary={primary} />}
      {as === 'shop' && open && <PaymentRefForm orderId={order.id} uid={uid} placeholder="PayPal transaction ID or bank reference you received" primary={primary} />}

      {next.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          {next.filter(s => s !== 'cancelled').map(s => (
            <button key={s} type="button" disabled={busy} onClick={() => move(s)} className={primary}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} {as === 'buyer' ? buyerLabel(s) : STATUS_BUTTON[s]}</button>
          ))}
          {next.includes('cancelled') && (confirmCancel ? (
            <span className="inline-flex gap-2 items-center text-[11px]">
              <span className="text-slate-600 dark:text-slate-300">Cancel this order?{as === 'shop' && order.status === 'paid' ? ' Refund the buyer yourself.' : ''}</span>
              <button type="button" disabled={busy} onClick={() => move('cancelled')} className="px-3 py-1.5 rounded-xl bg-red-500 text-white font-bold">Yes, cancel</button>
              <button type="button" onClick={() => setConfirmCancel(false)} className={ghostBtn}>No</button>
            </span>
          ) : (
            <button type="button" disabled={busy} onClick={() => setConfirmCancel(true)} className={`${ghostBtn} !text-red-600`}>Cancel order</button>
          ))}
        </div>
      )}
      <ErrorNote msg={err} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Receipt
// ---------------------------------------------------------------------------

export function ReceiptView({ receipt }: { receipt: ReceiptDoc }) {
  const r = receipt;
  return (
    <div className="space-y-3 text-xs text-slate-700 dark:text-slate-200">
      <div>
        <p className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">{r.orderNumber}</p>
        <p className="text-slate-500">{formatWhen(r.createdAt)}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <p><span className="text-slate-500">Shop:</span> <b>{r.shopName}</b><br /><span className="text-[10px] text-slate-400 font-mono break-all">ID {r.shopUid}</span></p>
        <p><span className="text-slate-500">Buyer:</span> <b>{r.buyerName}</b><br /><span className="text-[10px] text-slate-400 font-mono break-all">ID {r.buyerUid}</span></p>
      </div>
      <table className="w-full">
        <thead><tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700"><th className="py-1">Item</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Amount</th></tr></thead>
        <tbody>
          {r.items.map((i, k) => (
            <tr key={k} className="border-b border-slate-100 dark:border-slate-800"><td className="py-1 pr-2">{i.title}</td><td className="text-right">{i.qty}</td><td className="text-right font-mono">{formatPrice(i.unitPrice, r.currency)}</td><td className="text-right font-mono">{formatPrice(Math.round(i.qty * i.unitPrice * 100) / 100, r.currency)}</td></tr>
          ))}
          <tr><td colSpan={3} className="py-1">{r.fulfilment === 'deliver' ? 'Delivery fee' : 'Collected at the shop'}</td><td className="text-right font-mono">{formatPrice(r.deliveryFee, r.currency)}</td></tr>
          <tr className="font-bold text-sm"><td colSpan={3} className="py-1">Total ({r.currency})</td><td className="text-right font-mono">{formatPrice(r.total, r.currency)}</td></tr>
        </tbody>
      </table>
      <p><span className="text-slate-500">Payment:</span> <b>{PAY_SHORT[r.payment]}</b> · <span className="text-slate-500">Reference:</span> {r.paymentRef ? <b className="font-mono">{r.paymentRef}</b> : <span className="text-slate-400">not added yet</span>}</p>
      <div>
        <p className="text-slate-500 mb-1">Status history</p>
        <ol className="space-y-0.5">
          {(r.statusHistory || []).map((h, k) => <li key={k} className="flex items-center gap-2"><StatusChip status={h.status} /> <span className="text-slate-500">{formatWhen(h.at)}</span></li>)}
        </ol>
      </div>
      {r.adminNotes?.length > 0 && (
        <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 space-y-0.5">
          <p className="font-bold text-amber-800 dark:text-amber-300">Admin notes</p>
          {r.adminNotes.map((n, k) => <p key={k}>{n.note} <span className="text-slate-400">({formatWhen(n.at)})</span></p>)}
        </div>
      )}
      <p className="text-[10px] text-slate-400">This receipt can't be edited after the order is placed. It holds no card numbers, bank details or ID numbers.</p>
    </div>
  );
}

export function ReceiptModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [r, setR] = useState<ReceiptDoc | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => subscribeReceipt(orderId, setR), [orderId]);
  return (
    <Modal onClose={onClose}>
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 pr-8"><Receipt className="w-5 h-5" /> Receipt</h2>
        {r === undefined ? <p className="text-xs text-slate-400"><Loader2 className="w-3.5 h-3.5 animate-spin inline" /> Loading…</p>
          : !r ? <p className="text-xs text-slate-500">Receipt not found.</p>
          : <ReceiptView receipt={r} />}
        <ErrorNote msg={err} />
        <div className="flex justify-end gap-2">
          <button type="button" className={ghostBtn} onClick={onClose}>Close</button>
          {r && <button type="button" className={ghostBtn} onClick={() => { try { printReceipt(r); } catch (ex) { setErr(friendlyError(ex)); } }}><Printer className="w-3.5 h-3.5" /> Print or save as PDF</button>}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Admin Desk: all orders + receipts
// ---------------------------------------------------------------------------

export function AdminOrdersView({ actor }: { actor: Actor | null }) {
  const [orders, setOrders] = useState<OrderDoc[] | null>(null);
  const [receipts, setReceipts] = useState<Map<string, ReceiptDoc>>(new Map());
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'all' | OrderStatus>('open');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => subscribeAllOrders(o => { setOrders(o); setErr(null); }, e => { setOrders([]); setErr(friendlyError(e)); }), []);
  useEffect(() => subscribeAllReceipts(setReceipts), []);
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (orders || []).filter(o => (filter === 'all' ? true : filter === 'open' ? o.status !== 'collected' && o.status !== 'cancelled' : o.status === filter))
      .filter(o => !s || `${o.orderNumber} ${o.listingTitle} ${o.shopName} ${o.buyerName} ${o.buyerUid} ${o.shopUid} ${receipts.get(o.id)?.paymentRef || ''}`.toLowerCase().includes(s));
  }, [orders, filter, q, receipts]);
  if (orders === null) return <div className="py-12 text-center text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin inline" /> Loading orders…</div>;
  return (
    <div className="space-y-4">
      <ErrorNote msg={err} />
      <div className="flex flex-wrap gap-1.5 items-center">
        {(['open', 'all', 'placed', 'accepted', 'paid', 'sent', 'collected', 'cancelled'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${filter === f ? 'bg-gradient-to-r from-indigo-600 to-violet-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
            {f === 'open' ? 'Open' : f === 'all' ? `All (${orders.length})` : ORDER_STATUS_LABELS[f]}
          </button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search order no., shop, buyer, reference" className={`${inputCls} !w-64`} />
      </div>
      {visible.length === 0 ? (
        <div className={`${cardCls} py-10 text-center text-xs text-slate-500`}>No orders match.</div>
      ) : (
        <div className="space-y-2">
          {visible.map(o => {
            const r = receipts.get(o.id);
            return (
              <div key={o.id} className={`${cardCls} !rounded-2xl p-4 space-y-2`}>
                <button type="button" className="w-full text-left flex flex-wrap items-start justify-between gap-2" onClick={() => setOpen(open === o.id ? null : o.id)}>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{o.listingTitle}{o.qty > 1 ? ` × ${o.qty}` : ''}</p>
                    <p className="text-[11px] text-slate-500"><span className="font-mono">{o.orderNumber}</span> · {formatWhen(o.createdAt)} · {o.shopName} → {o.buyerName}</p>
                  </div>
                  <span className="flex items-center gap-2"><span className="font-mono font-bold text-sm">{formatPrice(o.total, o.currency)}</span><StatusChip status={o.status} /></span>
                </button>
                {open === o.id && (
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[11px] text-slate-500">
                      {o.fulfilment === 'deliver' ? `Delivery${o.buyerCountry ? ` to ${countryName(o.buyerCountry)}` : ''}${o.addressText ? `: ${o.addressText}` : ''}` : 'Buyer collects'} · {PAY_SHORT[o.payment]} · Buyer phone <span className="font-mono">{o.buyerPhone}</span>
                      {o.lat != null && o.lng != null && <> · <a className="font-bold text-indigo-600" href={mapLink(o.lat, o.lng)} target="_blank" rel="noopener noreferrer">pin</a></>}
                      {o.customsId && <> · Customs ID <span className="font-mono">{o.customsId}</span></>}
                    </p>
                    {r ? <ReceiptView receipt={r} /> : <p className="text-xs text-amber-700">No receipt found for this order.</p>}
                    {r && <AdminNoteForm receipt={r} actor={actor} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminNoteForm({ receipt, actor }: { receipt: ReceiptDoc; actor: Actor | null }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="space-y-1.5" onSubmit={async e => {
      e.preventDefault();
      if (!actor) { setErr('Sign in again.'); return; }
      setBusy(true); setErr(null);
      try { await adminAddReceiptNote(receipt, note, actor); setNote(''); } catch (ex) { setErr(friendlyError(ex)); } finally { setBusy(false); }
    }}>
      <div className="flex gap-2 flex-wrap">
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Add an admin note (e.g. Buyer sent proof of payment)" className={`${inputCls} flex-1 min-w-[12rem]`} maxLength={500} />
        <button type="submit" disabled={busy || !note.trim()} className={ghostBtn}>{busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Add note</button>
        <button type="button" className={ghostBtn} onClick={() => { try { printReceipt(receipt); } catch (ex) { setErr(friendlyError(ex)); } }}><Printer className="w-3.5 h-3.5" /> Print</button>
      </div>
      <p className="text-[10px] text-slate-400">Notes are added to the receipt and the audit log. Money fields on a receipt can never be changed.</p>
      <ErrorNote msg={err} />
    </form>
  );
}
