/**
 * Marketplace ordering settings.
 *
 * CUSTOMS_ID_COUNTRIES: countries whose customs ask buyers for a personal ID number when they import
 * from an overseas shop. The optional "ID number for customs" field shows ONLY when the buyer's
 * country is in this list AND the shop is in another country AND the item is delivered.
 * It is never shown or needed for local orders. Add or remove countries here (ISO 3166 code).
 */
export const CUSTOMS_ID_COUNTRIES: Record<string, { label: string; hint: string }> = {
  KR: { label: 'Personal Customs Clearance Code (PCCC)', hint: 'Starts with P, e.g. P123456789012. Korean customs needs it for parcels from overseas.' },
  BR: { label: 'CPF number', hint: 'Brazilian customs needs your CPF for parcels from overseas.' },
  CN: { label: 'Resident ID card number', hint: 'Chinese customs may ask for it for parcels from overseas.' },
  TR: { label: 'T.C. Kimlik No (ID number)', hint: 'Turkish customs needs it for parcels from overseas.' },
};

export function customsIdFor(buyerCountry: string, shopCountry: string, delivering: boolean) {
  if (!delivering || !buyerCountry || !shopCountry || buyerCountry === shopCountry) return null;
  return CUSTOMS_ID_COUNTRIES[buyerCountry] || null;
}

/** Most items one order can hold. Must match the rules (qty 1..99). */
export const MAX_ORDER_QTY = 99;
