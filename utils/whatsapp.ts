export type WhatsAppVersion = "web" | "desktop" | "app";

export const get_stored_whatsapp_preference = (): WhatsAppVersion => {
  try {
    const val = localStorage.getItem("lawyerWhatsAppVersion");
    if (val === "web" || val === "desktop" || val === "app") return val;
  } catch (e) {}
  return "web";
};

export const set_stored_whatsapp_preference = (version: WhatsAppVersion) => {
  try {
    localStorage.setItem("lawyerWhatsAppVersion", version);
  } catch (e) {}
};

export const open_whatsapp_url = (phone: string, text: string) => {
  const cleanPhone = phone.replace(/\D/g, "");
  const encodedText = encodeURIComponent(text);
  const pref = get_stored_whatsapp_preference();

  let url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  if (pref === "desktop") {
    url = `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`;
  } else if (pref === "web") {
    url = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }

  window.open(url, "_blank");
};
