/**
 * Normalize a phone number to E.164 format.
 *
 * Rules:
 *  - Reject if input contains characters other than digits, +, (, ), -, ., and spaces
 *  - Strip formatting characters to get digits and leading +
 *  - "+..." → keep as-is (user supplied full international number)
 *  - "00..." → replace 00 with + (international dialing prefix used in UK/EU)
 *  - 10 digits → assume US/Canada, prepend +1
 *  - 11 digits starting with 1 → assume US/Canada, prepend +
 *  - Anything else → return as-is with + prepended (best effort)
 *
 * Validation:
 *  - +1 numbers must have exactly 11 digits (country code + 10 local)
 *  - All numbers must have at least 10 digits after +
 *
 * Returns null if the input is empty/null or fails validation.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Only allow digits, +, (, ), -, ., and spaces
  if (/[^0-9+\-(). ]/.test(raw.trim())) return null;

  let cleaned = raw.replace(/[^0-9+]/g, '');
  if (!cleaned) return null;

  let result: string;

  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1);
    if (digits.length < 10) return null;
    result = cleaned;
  } else if (cleaned.startsWith('00')) {
    const digits = cleaned.slice(2);
    if (digits.length < 10) return null;
    result = `+${digits}`;
  } else if (cleaned.length === 10) {
    // 10 digits → US/Canada, prepend +1
    result = `+1${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    // 11 digits starting with 1 → US/Canada
    result = `+${cleaned}`;
  } else if (cleaned.length >= 10) {
    result = `+${cleaned}`;
  } else {
    return null;
  }

  // Validate +1 (US/Canada): must be exactly +1 followed by 10 digits
  if (result.startsWith('+1') && !/^\+1\d{10}$/.test(result)) {
    return null;
  }

  // General: must be + followed by at least 10 digits, no more than 15 (ITU E.164 max)
  if (!/^\+\d{10,15}$/.test(result)) {
    return null;
  }

  return result;
}
