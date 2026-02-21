import { getAdminClient } from "../_lib/supabaseAdmin.js";
import { requireAdmin } from "../_lib/auth.js";
import { ApiError, parseJsonBody, sendJson } from "../_lib/http.js";
import { runApiSecurity } from "../_lib/security.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    runApiSecurity(req, { rateLimitKey: "quotes:mark-sent", max: 120, windowMs: 5 * 60_000 });
    let admin;
    try {
      admin = getAdminClient();
    } catch (envErr) {
      throw new ApiError(500, envErr.message || "Server environment is misconfigured.");
    }
    await requireAdmin(req, admin);
    const body = await parseJsonBody(req);
    const quoteId = typeof body.quoteId === "string" ? body.quoteId : "";
    const sentAt = typeof body.sentAt === "string" ? body.sentAt : null;

    if (!quoteId) throw new ApiError(400, "quoteId is required.");

    const { data, error } = await admin.rpc("mark_quote_sent", {
      p_quote_id: quoteId,
      p_sent_at: sentAt,
    });

    if (error) {
      console.error("[api/quotes/mark-sent] rpc failed", { quoteId, error });
      throw new ApiError(500, "Failed to mark quote as sent.", error.message);
    }

    const row = Array.isArray(data) ? data[0] : data;
    return sendJson(res, 200, {
      ok: true,
      quote: { id: row?.quote_id || quoteId, status: "sent" },
      enquiry: { id: row?.enquiry_id || null, status: row?.enquiry_status || "quote_sent" },
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : "Internal server error.";
    const details = error instanceof ApiError ? error.details : null;
    console.error("[api/quotes/mark-sent] request failed", error);
    return sendJson(res, status, { error: message, details });
  }
}
