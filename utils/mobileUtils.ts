// utils/mobileUtils.ts

/**
 * Converts Eastern Arabic (٠-٩) and Persian (۰-۹) digits to standard Latin digits (0-9).
 * Also strips hidden directional unicode formatting characters.
 */
export const convert_arabic_digits_to_latin = (str: string): string => {
  if (!str) return "";
  return str
    .replace(/[\u200E\u200F\u202A-\u202E\u200B\u00A0]/g, "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776));
};

/**
 * Extracts digits after converting Arabic digits.
 */
export const extract_clean_digits = (mobile: string): string => {
  if (!mobile) return "";
  const latinStr = convert_arabic_digits_to_latin(mobile.trim());
  return latinStr.replace(/\D/g, "");
};

/**
 * Normalizes any phone number into E.164 format (+963... for Syria, or international +...).
 * Accurately handles Arabic digits, spaces, dashes, 09x, 9x, +963x, 00963x.
 */
export const normalize_mobile_to_e164 = (mobile: string): string | null => {
  if (!mobile) return null;
  const trimmed = mobile.trim();
  if (trimmed.includes("@")) return null; // Email input, not a phone

  const digits = extract_clean_digits(trimmed);
  if (!digits || digits.length < 7) return null;

  // Syrian number patterns:
  // Starts with 00963 -> 14 or 13 digits
  if (digits.startsWith("00963")) {
    const rest = digits.slice(5).replace(/^0+/, "");
    if (rest.length === 9 && rest.startsWith("9")) {
      return `+963${rest}`;
    }
  }

  // Starts with 963 -> 12 digits
  if (digits.startsWith("963")) {
    const rest = digits.slice(3).replace(/^0+/, "");
    if (rest.length === 9 && rest.startsWith("9")) {
      return `+963${rest}`;
    }
  }

  // Standard Syrian local mobile starting with 09... (10 digits)
  if (digits.startsWith("09") && digits.length === 10) {
    return `+963${digits.slice(1)}`;
  }

  // Syrian mobile without leading zero: 9... (9 digits)
  if (digits.startsWith("9") && digits.length === 9) {
    return `+963${digits}`;
  }

  // Check if ending has standard 9 Syrian digits starting with 9
  if (digits.length >= 9) {
    const last_nine = digits.slice(-9);
    if (last_nine.startsWith("9")) {
      return `+963${last_nine}`;
    }
  }

  // International numbers
  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }
  if (digits.startsWith("00")) {
    return `+${digits.slice(2)}`;
  }

  // General fallback for non-Syrian numbers
  return `+${digits}`;
};

/**
 * Normalizes phone number for database storage (09xxxxxxxx for Syrian numbers).
 */
export const normalize_mobile_for_db = (mobile: string): string | null => {
  if (!mobile) return null;
  const trimmed = mobile.trim();
  if (trimmed.includes("@")) return null;

  const digits = extract_clean_digits(trimmed);
  if (!digits || digits.length < 7) return null;

  // Syrian number ending in 9 digits starting with 9
  if (digits.length >= 9) {
    const last_nine = digits.slice(-9);
    if (last_nine.startsWith("9")) {
      return `0${last_nine}`;
    }
  }

  // If international number
  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }
  if (digits.startsWith("00")) {
    return `+${digits.slice(2)}`;
  }

  return digits;
};

/**
 * Returns all possible auth email variations for a given login input (phone or email).
 * This ensures backwards compatibility with any account created in different formats.
 */
export const get_possible_auth_emails = (input: string): string[] => {
  if (!input) return [];
  const cleanInput = convert_arabic_digits_to_latin(input.trim());

  // Direct email entered
  if (cleanInput.includes("@")) {
    const normalizedEmail = cleanInput.toLowerCase();
    return Array.from(new Set([normalizedEmail, cleanInput]));
  }

  const emails: string[] = [];
  const digits = extract_clean_digits(cleanInput);
  const e164 = normalize_mobile_to_e164(cleanInput);

  if (e164) {
    const e164Digits = e164.replace("+", "");
    emails.push(`sy${e164Digits}@email.com`); // Standard: sy963958932922@email.com
    emails.push(`${e164Digits}@email.com`);   // 963958932922@email.com
  }

  if (digits.length >= 9) {
    const lastNine = digits.slice(-9);
    emails.push(`sy${lastNine}@email.com`);      // sy958932922@email.com
    emails.push(`sy0${lastNine}@email.com`);     // sy0958932922@email.com
    emails.push(`sy963${lastNine}@email.com`);   // sy963958932922@email.com
    emails.push(`0${lastNine}@email.com`);       // 0958932922@email.com
    emails.push(`${lastNine}@email.com`);        // 958932922@email.com
  }

  if (digits) {
    emails.push(`sy${digits}@email.com`);
    emails.push(`${digits}@email.com`);
  }

  return Array.from(new Set(emails));
};

/**
 * Returns all possible database phone representation strings to search in profiles table.
 */
export const get_possible_db_mobiles = (input: string): string[] => {
  if (!input) return [];
  const cleanInput = convert_arabic_digits_to_latin(input.trim());
  const variants: string[] = [cleanInput, input.trim()];

  const digits = extract_clean_digits(cleanInput);
  if (digits) {
    variants.push(digits);
    if (digits.length >= 9) {
      const lastNine = digits.slice(-9);
      variants.push(`0${lastNine}`);       // 0958932922
      variants.push(`+963${lastNine}`);    // +963958932922
      variants.push(`963${lastNine}`);     // 963958932922
      variants.push(`00963${lastNine}`);   // 00963958932922
      variants.push(lastNine);             // 958932922
    }
  }

  const e164 = normalize_mobile_to_e164(cleanInput);
  if (e164) variants.push(e164);

  const dbMobile = normalize_mobile_for_db(cleanInput);
  if (dbMobile) variants.push(dbMobile);

  return Array.from(new Set(variants.filter(Boolean)));
};

export const DESIGNATED_ADMIN_EMAILS = [
  "nahwiabdo@gmail.com",
  "avocat.nahwi@gmail.com",
  "sy963958932922@email.com",
  "sy0958932922@email.com",
  "963958932922@email.com",
  "0958932922@email.com",
  "958932922@email.com",
  "sy958932922@email.com",
  "sy963958333333@email.com",
  "sy0958333333@email.com",
  "963958333333@email.com",
  "0958333333@email.com",
  "958333333@email.com",
  "sy958333333@email.com",
  "sy963987654321@email.com",
  "sy0987654321@email.com",
  "963987654321@email.com",
  "0987654321@email.com",
  "987654321@email.com",
  "sy987654321@email.com",
];

const DESIGNATED_ADMIN_IDS = [
  "0fbfa850-2daf-43e8-99e8-7aea7af06c03",
  "fb4b2bc8-591d-423f-829b-266b31d4526a",
  "fdf70b78-417d-4f3c-87b0-e585d053652a",
];

const DESIGNATED_ADMIN_MOBILE_SUFFIXES = [
  "958932922",
  "958333333",
  "987654321",
];

const DESIGNATED_ADMIN_NAMES = [
  "المدير",
  "المدير العام",
  "مدير المنصة",
  "مدير النظام",
];

/**
 * Reliably determines whether a user/profile belongs to a platform administrator.
 */
export const is_platform_admin = (user?: any, profile?: any): boolean => {
  if (!user && !profile) return false;

  if (profile?.role === "admin") return true;
  if (user?.user_metadata?.role === "admin" || user?.app_metadata?.role === "admin") {
    return true;
  }

  const uid = user?.id || profile?.id;
  if (uid && DESIGNATED_ADMIN_IDS.includes(uid)) {
    return true;
  }

  const email = (user?.email || user?.user_metadata?.email || "").trim().toLowerCase();
  if (email && DESIGNATED_ADMIN_EMAILS.includes(email)) {
    return true;
  }

  const fullName = (profile?.full_name || user?.user_metadata?.full_name || "").trim();
  if (fullName && DESIGNATED_ADMIN_NAMES.includes(fullName)) {
    return true;
  }

  const rawMobiles = [
    profile?.mobile_number,
    user?.user_metadata?.mobile_number,
    user?.phone,
    email,
  ].filter(Boolean);

  for (const m of rawMobiles) {
    const digits = extract_clean_digits(String(m));
    if (digits.length >= 9) {
      const lastNine = digits.slice(-9);
      if (DESIGNATED_ADMIN_MOBILE_SUFFIXES.includes(lastNine)) {
        return true;
      }
    }
  }

  return false;
};


