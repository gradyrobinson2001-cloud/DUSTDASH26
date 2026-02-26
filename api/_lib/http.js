export class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function sendJson(res, status, payload) {
  res.status(status)
    .setHeader("Content-Type", "application/json; charset=utf-8")
    .setHeader("Cache-Control", "no-store, max-age=0")
    .setHeader("Pragma", "no-cache")
    .setHeader("X-Content-Type-Options", "nosniff")
    .setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
    .setHeader("X-Frame-Options", "DENY")
    .setHeader("Cross-Origin-Resource-Policy", "same-origin")
    .setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  res.end(JSON.stringify(payload));
}

export async function parseJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}
