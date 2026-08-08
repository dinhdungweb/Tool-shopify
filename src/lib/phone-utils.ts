/**
 * Return digit-only aliases for a Vietnamese phone number.
 *
 * Example: 0964374773, +84964374773 and 964374773 all produce:
 * - 964374773
 * - 0964374773
 * - 84964374773
 */
export function getVietnamesePhoneVariations(phone: string): string[] {
  let digits = phone.replace(/\D/g, "");

  if (digits.startsWith("0084")) {
    digits = digits.substring(2);
  }

  if (!digits) return [];

  const variations = new Set<string>([digits]);
  let subscriberNumber = "";

  if (digits.startsWith("84")) {
    subscriberNumber = digits.substring(2);
  } else if (digits.startsWith("0")) {
    subscriberNumber = digits.substring(1);
  } else if (digits.length >= 9 && digits.length <= 10) {
    subscriberNumber = digits;
  }

  // Preserve the older auto-match behavior for unusual 10-digit input while
  // only using a canonical 9-digit subscriber number for substring searches.
  if (subscriberNumber) {
    variations.add(subscriberNumber);
    variations.add(`0${subscriberNumber}`);
    variations.add(`84${subscriberNumber}`);
  }

  return Array.from(variations);
}

/**
 * Stable 9-digit part used for local substring searches across 0/84/+84 forms.
 */
export function getVietnamesePhoneSearchKey(phone: string): string | null {
  const variations = getVietnamesePhoneVariations(phone);
  const subscriberNumber = variations.find((variation) => variation.length === 9);

  return subscriberNumber || null;
}
