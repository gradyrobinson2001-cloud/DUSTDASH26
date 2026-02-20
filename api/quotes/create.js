import { getAdminClient } from "../_lib/supabaseAdmin.js";
import { requireAdmin } from "../_lib/auth.js";
import { ApiError, parseJsonBody, sendJson } from "../_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    const admin = getAdminClient();
    const { user } = await requireAdmin(req, admin);
    const body = await parseJsonBody(req);
    const enquiryId = typeof body.enquiryId === "string" ? body.enquiryId : "";

    if (!enquiryId) throw new ApiError(400, "enquiryId is required.");

    const { data, error } = await admin.rpc("create_quote_for_enquiry", {
      p_enquiry_id: enquiryId,
      p_actor_id: user.id,
    });

    if (error) {
      console.error("[api/quotes/create] rpc failed", { enquiryId, error });
      throw new ApiError(500, "Failed to create quote.", error.message);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.quote_id) {
      throw new ApiError(500, "Quote creation returned an empty result.");
    }

    return sendJson(res, 200, {
      ok: true,
      quote: { id: row.quote_id },
      enquiry: { id: row.enquiry_id, status: row.enquiry_status },
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : "Internal server error.";
    const details = error instanceof ApiError ? error.details : null;
    console.error("[api/quotes/create] request failed", error);
    return sendJson(res, status, { error: message, details });
  }
}

