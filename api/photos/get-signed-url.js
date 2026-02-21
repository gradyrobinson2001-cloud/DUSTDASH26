import { getAdminClient } from "../_lib/supabaseAdmin.js";
import { requireProfile } from "../_lib/auth.js";
import { ApiError, parseJsonBody, sendJson } from "../_lib/http.js";
import { runApiSecurity } from "../_lib/security.js";

const PATH_RE = /^[a-zA-Z0-9_-]+\/\d{4}-\d{2}-\d{2}\/[a-zA-Z0-9._-]+$/;

function isValidPhotoPath(value) {
  const path = String(value || "").trim();
  if (!path) return false;
  if (path.includes("..")) return false;
  return PATH_RE.test(path);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    runApiSecurity(req, { rateLimitKey: "photos:get-signed-url", max: 500, windowMs: 5 * 60_000 });
    let admin;
    try {
      admin = getAdminClient();
    } catch (envErr) {
      throw new ApiError(500, envErr.message || "Server environment is misconfigured.");
    }

    const { user, profile } = await requireProfile(req, admin, { roles: ["admin", "staff"], requireActive: true });
    const body = await parseJsonBody(req);
    const storagePath = String(body?.storagePath || "").trim();

    if (!isValidPhotoPath(storagePath)) {
      throw new ApiError(400, "Invalid storage path.");
    }

    const { data: photoRow, error: photoErr } = await admin
      .from("photos")
      .select("id, job_id, uploaded_by")
      .eq("storage_path", storagePath)
      .maybeSingle();
    if (photoErr) throw new ApiError(500, "Failed to verify photo path.", photoErr.message);
    if (!photoRow) throw new ApiError(404, "Photo not found.");

    if (profile.role === "staff") {
      const isUploader = String(photoRow.uploaded_by || "") === String(user.id);
      if (!isUploader) {
        const { data: assignedJob, error: assignErr } = await admin
          .from("scheduled_jobs")
          .select("id")
          .eq("id", String(photoRow.job_id || ""))
          .contains("assigned_staff", [user.id])
          .maybeSingle();
        if (assignErr) throw new ApiError(500, "Failed to verify photo access.", assignErr.message);
        if (!assignedJob) throw new ApiError(403, "Access denied for this photo.");
      }
    }

    const { data, error } = await admin.storage
      .from("job-photos")
      .createSignedUrl(storagePath, 60 * 60);
    if (error || !data?.signedUrl) {
      throw new ApiError(500, "Failed to generate signed URL.", error?.message || null);
    }

    return sendJson(res, 200, { ok: true, signedUrl: data.signedUrl });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : "Internal server error.";
    const details = error instanceof ApiError ? error.details : null;
    console.error("[api/photos/get-signed-url] request failed", error);
    return sendJson(res, status, { error: message, details });
  }
}
