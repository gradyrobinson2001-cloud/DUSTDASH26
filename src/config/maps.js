// Browser Maps keys are public by design, but should still be domain-restricted.
const PROVIDED_FALLBACK_GOOGLE_MAPS_API_KEY = "AIzaSyAI5KlcXZB9gs1u4Qb95SSsrQZM60aDuhI";

function safeReadLocalStorage(key) {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage?.getItem(key) || "";
  } catch {
    return "";
  }
}

export function getGoogleMapsApiKey() {
  const envKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    import.meta.env.VITE_MAPS_API_KEY ||
    "";

  const runtimeKey =
    (typeof window !== "undefined" ? window.__DUSTDASH_MAPS_API_KEY : "") ||
    safeReadLocalStorage("google_maps_api_key");

  return String(envKey || runtimeKey || PROVIDED_FALLBACK_GOOGLE_MAPS_API_KEY || "").trim();
}

export function isGoogleMapsKeyConfigured(key) {
  const value = String(key || "").trim();
  return Boolean(value) && value !== "YOUR_API_KEY_HERE";
}
