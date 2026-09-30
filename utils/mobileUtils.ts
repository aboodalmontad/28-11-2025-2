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
