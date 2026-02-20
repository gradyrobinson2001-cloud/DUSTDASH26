import { getAdminClient } from "../_lib/supabaseAdmin.js";
import { requireProfile } from "../_lib/auth.js";
import { ApiError, parseJsonBody, sendJson } from "../_lib/http.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    let admin;
    try {
      admin = getAdminClient();
    } catch (envErr) {
      throw new ApiError(500, envErr.message || "Server environment is misconfigured.");
    }

    const { user } = await requireProfile(req, admin, { roles: ["admin", "staff"], requireActive: true });
    const body = await parseJsonBody(req);

    const jobId = String(body.jobId || "").trim();
    const clientId = body.clientId == null ? null : String(body.clientId).trim();
    const date = String(body.date || "").trim();
    const type = body.type === "after" ? "after" : "before";
    const storagePath = String(body.storagePath || body.path || "").trim();

    if (!jobId) throw new ApiError(400, "jobId is required.");
    if (!DATE_RE.test(date)) throw new ApiError(400, "date must be YYYY-MM-DD.");
    if (!storagePath) throw new ApiError(400, "storagePath is required.");

    const expectedPrefix = `${jobId}/${date}/`;
    if (!storagePath.startsWith(expectedPrefix)) {
      throw new ApiError(400, "storagePath does not match job/date.");
    }

    const { data, error } = await admin
      .from("photos")
      .insert({
        job_id: jobId,
        client_id: clientId,
        date,
        type,
        storage_path: storagePath,
        uploaded_by: user.id,
      })
      .select("*")
      .single();

    if (error || !data) {
      console.error("[api/photos/complete-upload] insert failed", { jobId, storagePath, error });
      throw new ApiError(500, "Failed to save photo record.", error?.message || null);
    }

    return sendJson(res, 200, { ok: true, photo: data });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : "Internal server error.";
    const details = error instanceof ApiError ? error.details : null;
    console.error("[api/photos/complete-upload] request failed", error);
    return sendJson(res, status, { error: message, details });
  }
}
