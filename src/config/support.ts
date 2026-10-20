// Optional donations ("Support the app"). Every feature stays free; this is only a link to PayPal.
// Change the URL here (or set VITE_PAYPAL_DONATE_URL in Netlify) to point donations elsewhere.
// Set it to an empty string to hide the donate buttons.
export const PAYPAL_DONATE_URL: string =
  (import.meta.env.VITE_PAYPAL_DONATE_URL as string | undefined) ??
  'https://www.paypal.com/donate/?business=sbheko1%40gmail.com&no_recurring=0&item_name=Support+DIY+Electronics&currency_code=USD';

export const DONATION_PRESETS_USD = [2, 5, 10];

/** PayPal link for an amount (USD). Without an amount PayPal lets the donor choose. */
export function donateUrl(amount?: number): string {
  if (!PAYPAL_DONATE_URL) return '';
  if (!amount || !Number.isFinite(amount) || amount <= 0) return PAYPAL_DONATE_URL;
  const sep = PAYPAL_DONATE_URL.includes('?') ? '&' : '?';
  return `${PAYPAL_DONATE_URL}${sep}amount=${encodeURIComponent(amount.toFixed(2))}`;
}
