import { ApiError } from "./http.js";

const RATE_STORE_KEY = "__dustdash_rate_limit_store_v1__";
const rateStore = globalThis[RATE_STORE_KEY] || new Map();
globalThis[RATE_STORE_KEY] = rateStore;

function header(req, key) {
  return req?.headers?.[key] || req?.headers?.[key.toLowerCase()] || req?.headers?.[key.toUpperCase()] || "";
}

function getClientIp(req) {
  const forwarded = String(header(req, "x-forwarded-for") || "").split(",")[0].trim();
  return forwarded || String(req?.socket?.remoteAddress || req?.connection?.remoteAddress || "unknown");
}

function trimOrigin(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function pruneRateStore(nowMs) {
  if (rateStore.size < 8000) return;
  for (const [key, record] of rateStore.entries()) {
    if (!record || record.resetAt <= nowMs) rateStore.delete(key);
  }
}

export function enforceTrustedOrigin(req) {
  const origin = trimOrigin(header(req, "origin"));
  if (!origin) return;

  const host = String(header(req, "x-forwarded-host") || header(req, "host") || "").trim();
  const inferred = host
    ? [trimOrigin(`https://${host}`), trimOrigin(`http://${host}`)]
    : [];
  const configured = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(trimOrigin)
    .filter(Boolean);
  const allowlist = new Set([...inferred, ...configured]);

  if (!allowlist.has(origin)) {
    throw new ApiError(403, "Blocked request origin.");
  }
}

export function applyRateLimit(req, { key = "api", windowMs = 60_000, max = 60 } = {}) {
  const now = Date.now();
  pruneRateStore(now);
  const ip = getClientIp(req);
  const bucketKey = `${key}:${ip}`;
  const existing = rateStore.get(bucketKey);

  if (!existing || now >= existing.resetAt) {
    rateStore.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return;
  }

  existing.count += 1;
  if (existing.count > max) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    throw new ApiError(429, `Rate limit exceeded. Retry in ${retryAfter}s.`);
  }
}

export function enforceJsonContentType(req) {
  const contentType = String(header(req, "content-type") || "").toLowerCase();
  if (!contentType) return;
  if (!contentType.includes("application/json")) {
    throw new ApiError(415, "Unsupported content type. Use application/json.");
  }
}

export function runApiSecurity(req, { rateLimitKey, windowMs, max } = {}) {
  enforceTrustedOrigin(req);
  enforceJsonContentType(req);
  applyRateLimit(req, { key: rateLimitKey || "api", windowMs: windowMs || 60_000, max: max || 60 });
}
