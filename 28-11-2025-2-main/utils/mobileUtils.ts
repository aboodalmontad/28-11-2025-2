export const normalize_mobile_to_e164 = (mobile: string): string | null => {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length >= 9) {
    const last_nine = digits.slice(-9);
    if (last_nine.startsWith("9")) {
      return `+963${last_nine}`;
    }
  }
  return null;
};

export const normalize_mobile_for_db = (mobile: string): string | null => {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length >= 9) {
    const last_nine = digits.slice(-9);
    if (last_nine.startsWith("9")) {
      return "0" + last_nine;
    }
  }
  return null;
};

export const is_admin_account = (email?: string | null) => {
  if (!email || typeof email !== 'string') return false;
  return email.toLowerCase() === "avocat.nahwi@gmail.com" || email.toLowerCase().includes("admin");
};

export const is_designated_admin_identifier = (identifier?: string | null) => {
  if (!identifier || typeof identifier !== 'string') return false;
  return identifier.toLowerCase() === "avocat.nahwi@gmail.com" || identifier.toLowerCase().includes("admin");
};

export const get_possible_db_mobiles = (mobile: string): string[] => {
  const digits = mobile.replace(/\D/g, "");
  const results = [mobile];
  if (digits) {
    results.push(digits);
    if (digits.length >= 9) {
      const last_nine = digits.slice(-9);
      results.push(last_nine);
      results.push("0" + last_nine);
      results.push("+963" + last_nine);
    }
  }
  return Array.from(new Set(results));
};
