export type WhatsAppVersion = "app" | "business" | "web";

const STORAGE_KEY = "whatsapp_version_choice";

export const get_stored_whatsapp_preference = (
  userId?: string | null,
): WhatsAppVersion | null => {
  try {
    if (typeof localStorage === "undefined") return null;

    if (userId) {
      const userChoice = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
      if (
        userChoice === "app" ||
        userChoice === "business" ||
        userChoice === "web"
      ) {
        return userChoice;
      }
      if (userChoice === "ask" || userChoice === "none") {
        return null;
      }
    }

    const globalChoice = localStorage.getItem(STORAGE_KEY);
    if (
      globalChoice === "app" ||
      globalChoice === "business" ||
      globalChoice === "web"
    ) {
      return globalChoice;
    }
    return null;
  } catch (e) {
    console.error("Error reading WhatsApp preference:", e);
    return null;
  }
};

export const set_stored_whatsapp_preference = (
  pref: WhatsAppVersion | null,
  userId?: string | null,
): void => {
  try {
    if (typeof localStorage === "undefined") return;

    if (pref) {
      localStorage.setItem(STORAGE_KEY, pref);
      if (userId) {
        localStorage.setItem(`${STORAGE_KEY}_${userId}`, pref);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY);
      if (userId) {
        localStorage.setItem(`${STORAGE_KEY}_${userId}`, "ask");
      }
    }
  } catch (e) {
    console.error("Error saving WhatsApp preference:", e);
  }
};

export const open_whatsapp_url = (
  text: string,
  phone?: string,
  version: WhatsAppVersion = "app",
): void => {
  const cleanText = encodeURIComponent(text);
  const cleanPhone = phone ? phone.replace(/\D/g, "") : "";

  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid =
    typeof navigator !== "undefined" && /Android/.test(navigator.userAgent);

  let url = "";
  let useDirectHref = false;

  if (version === "web") {
    url = cleanPhone
      ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${cleanText}`
      : `https://web.whatsapp.com/send?text=${cleanText}`;
  } else if (version === "business") {
    if (isIOS) {
      url = cleanPhone
        ? `whatsapp-business://send?phone=${cleanPhone}&text=${cleanText}`
        : `whatsapp-business://send?text=${cleanText}`;
      useDirectHref = true;
    } else if (isAndroid) {
      // Force WhatsApp Business package specifically on Android
      url = cleanPhone
        ? `intent://send?phone=${cleanPhone}&text=${cleanText}#Intent;package=com.whatsapp.w4b;scheme=whatsapp;end`
        : `intent://send?text=${cleanText}#Intent;package=com.whatsapp.w4b;scheme=whatsapp;end`;
      useDirectHref = true;
    } else {
      // Desktop / Generic Fallback
      url = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${cleanText}`
        : `https://wa.me/?text=${cleanText}`;
    }
  } else {
    // Default / Standard app ("app")
    if (isIOS) {
      url = cleanPhone
        ? `whatsapp://send?phone=${cleanPhone}&text=${cleanText}`
        : `whatsapp://send?text=${cleanText}`;
      useDirectHref = true;
    } else if (isAndroid) {
      // Force standard WhatsApp package specifically on Android
      url = cleanPhone
        ? `intent://send?phone=${cleanPhone}&text=${cleanText}#Intent;package=com.whatsapp;scheme=whatsapp;end`
        : `intent://send?text=${cleanText}#Intent;package=com.whatsapp;scheme=whatsapp;end`;
      useDirectHref = true;
    } else {
      // Desktop / Generic Fallback
      url = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${cleanText}`
        : `https://wa.me/?text=${cleanText}`;
    }
  }

  if (useDirectHref) {
    window.location.href = url;
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 100);
  }
};
