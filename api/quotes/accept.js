import { getAdminClient } from "../_lib/supabaseAdmin.js";
import { requireAdmin } from "../_lib/auth.js";
import { ApiError, parseJsonBody, sendJson } from "../_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    let admin;
    try {
      admin = getAdminClient();
    } catch (envErr) {
      throw new ApiError(500, envErr.message || "Server environment is misconfigured.");
    }
    const { user } = await requireAdmin(req, admin);
    const body = await parseJsonBody(req);
    const quoteId = typeof body.quoteId === "string" ? body.quoteId : "";

    if (!quoteId) throw new ApiError(400, "quoteId is required.");

    const { data, error } = await admin.rpc("accept_quote_and_upsert_client", {
      p_quote_id: quoteId,
      p_actor_id: user.id,
    });

    if (error) {
      console.error("[api/quotes/accept] rpc failed", { quoteId, error });
      throw new ApiError(500, "Failed to accept quote.", error.message);
    }

    const row = Array.isArray(data) ? data[0] : data;
    return sendJson(res, 200, {
      ok: true,
      quote: { id: row?.quote_id || quoteId, status: "accepted" },
      enquiry: { id: row?.enquiry_id || null, status: row?.enquiry_status || "accepted" },
      client: { id: row?.client_id || null, name: row?.client_name || null, status: row?.client_status || "active" },
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : "Internal server error.";
    const details = error instanceof ApiError ? error.details : null;
    console.error("[api/quotes/accept] request failed", error);
    return sendJson(res, status, { error: message, details });
  }
}
