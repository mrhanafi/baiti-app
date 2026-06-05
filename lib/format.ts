/**
 * Formats a Malaysian IC number as the user types: 911212-14-1234.
 *
 * Strips non-digits, caps at 12, and inserts dashes at the standard
 * MyKad positions (6 + 2 + 4).
 */
export function formatMyIc(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  if (digits.length <= 6) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
}

/**
 * Normalises a Malaysian phone number entered without country code into the
 * canonical +60 form. Accepts:
 *   "0121234567"      → "+60121234567"
 *   "121234567"       → "+60121234567"
 *   "+60121234567"    → "+60121234567"  (unchanged)
 * Empty / whitespace-only input returns null so callers can drop the field.
 */
export function normaliseMyPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return null;
  return `+60${digits}`;
}
