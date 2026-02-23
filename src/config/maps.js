// Browser Maps keys are public by design, but should still be domain-restricted.

function safeReadLocalStorage(key) {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage?.getItem(key) || "";
  } catch {
    return "";
  }
}

function safeWriteLocalStorage(key, value) {
  if (typeof window === "undefined") return;
  try {
    if (!value) window.localStorage?.removeItem(key);
    else window.localStorage?.setItem(key, value);
  } catch {
    // no-op (private browsing / restricted storage)
  }
}

export function getGoogleMapsApiKey() {
  const envKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    import.meta.env.VITE_GOOGLE_MAPS_KEY ||
    import.meta.env.VITE_GOOGLE_MAPS_API ||
    import.meta.env.VITE_MAPS_API_KEY ||
    import.meta.env.VITE_MAPS_KEY ||
    "";

  const windowConfigKey =
    (typeof window !== "undefined" && window.__DUSTDASH_CONFIG__ && window.__DUSTDASH_CONFIG__.googleMapsApiKey)
      ? String(window.__DUSTDASH_CONFIG__.googleMapsApiKey)
      : "";

  const runtimeKey =
    (typeof window !== "undefined" ? window.__DUSTDASH_MAPS_API_KEY : "") ||
    windowConfigKey ||
    safeReadLocalStorage("google_maps_api_key") ||
    safeReadLocalStorage("maps_api_key");

  return String(envKey || runtimeKey || "").trim();
}

export function isGoogleMapsKeyConfigured(key) {
  const value = String(key || "").trim();
  return Boolean(value) && value !== "YOUR_API_KEY_HERE";
}

export function setGoogleMapsApiKey(key) {
  const clean = String(key || "").trim();
  safeWriteLocalStorage("google_maps_api_key", clean);
  safeWriteLocalStorage("maps_api_key", clean);
  if (typeof window !== "undefined") {
    window.__DUSTDASH_MAPS_API_KEY = clean;
    try {
      window.dispatchEvent(new CustomEvent("dustdash:maps-key-updated", { detail: { key: clean } }));
    } catch {
      // ignore CustomEvent failures on older engines
    }
  }
  return clean;
}
