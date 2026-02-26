import { getAdminClient } from "../_lib/supabaseAdmin.js";
import { requireProfile } from "../_lib/auth.js";
import { ApiError, parseJsonBody, sendJson } from "../_lib/http.js";
import { runApiSecurity } from "../_lib/security.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const extFromName = (fileName) => {
  const part = String(fileName || "").trim().split(".").pop()?.toLowerCase();
  if (part && part.length <= 5) return part;
  return "";
};

const extFromType = (contentType) => {
  const part = String(contentType || "").trim().split("/").pop()?.toLowerCase();
  if (!part) return "";
  if (part === "jpeg") return "jpg";
  return part;
};

const sanitize = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "");

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    runApiSecurity(req, { rateLimitKey: "photos:create-upload", max: 160, windowMs: 5 * 60_000 });
    let admin;
    try {
      admin = getAdminClient();
    } catch (envErr) {
      throw new ApiError(500, envErr.message || "Server environment is misconfigured.");
    }

    const { user, profile } = await requireProfile(req, admin, { roles: ["admin", "staff"], requireActive: true });
    const body = await parseJsonBody(req);

    const jobId = String(body.jobId || "").trim();
    const clientId = body.clientId == null ? null : String(body.clientId).trim();
    const dateInput = String(body.date || "").trim();
    const type = body.type === "after" ? "after" : "before";
    const fileName = String(body.fileName || "").trim();
    const contentType = String(body.contentType || "").trim() || "image/jpeg";
    const fileSize = Number(body.fileSize);
    const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
    const ALLOWED_IMAGE_TYPES = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
      "image/heic",
      "image/heif",
    ]);

    if (!jobId) throw new ApiError(400, "jobId is required.");
    if (!ALLOWED_IMAGE_TYPES.has(contentType.toLowerCase())) {
      throw new ApiError(400, "Unsupported image format.");
    }
    if (Number.isFinite(fileSize) && fileSize > MAX_UPLOAD_BYTES) {
      throw new ApiError(413, "Photo is too large. Max size is 20MB.");
    }

    let jobQuery = admin
      .from("scheduled_jobs")
      .select("id, client_id, date, assigned_staff")
      .eq("id", jobId)
      .maybeSingle();
    if (profile.role === "staff") {
      jobQuery = jobQuery.contains("assigned_staff", [user.id]);
    }
    const { data: jobRow, error: jobErr } = await jobQuery;
    if (jobErr) throw new ApiError(500, "Failed to verify job access.", jobErr.message);
    if (!jobRow) throw new ApiError(403, "You are not allowed to upload photos for this job.");

    if (clientId && jobRow.client_id && String(jobRow.client_id) !== clientId) {
      throw new ApiError(400, "clientId does not match job.");
    }

    const jobDate = DATE_RE.test(String(jobRow.date || "")) ? String(jobRow.date) : "";
    const date = jobDate || (DATE_RE.test(dateInput) ? dateInput : new Date().toISOString().split("T")[0]);
    const resolvedClientId = jobRow.client_id ? String(jobRow.client_id) : (clientId || null);

    const ext = extFromName(fileName) || extFromType(contentType) || "jpg";
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const path = `${sanitize(jobId)}/${date}/${unique}-${type}.${sanitize(ext) || "jpg"}`;

    const { data, error } = await admin.storage.from("job-photos").createSignedUploadUrl(path);
    if (error || !data?.token || !data?.path) {
      console.error("[api/photos/create-upload] createSignedUploadUrl failed", { jobId, date, error });
      throw new ApiError(500, "Failed to prepare upload URL.", error?.message || null);
    }

    return sendJson(res, 200, {
      ok: true,
      upload: {
        bucket: "job-photos",
        path: data.path,
        token: data.token,
        signedUrl: data.signedUrl,
        contentType,
      },
      photo: {
        job_id: jobId,
        client_id: resolvedClientId,
        date,
        type,
        uploaded_by: user.id,
      },
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : "Internal server error.";
    const details = error instanceof ApiError ? error.details : null;
    console.error("[api/photos/create-upload] request failed", error);
    return sendJson(res, status, { error: message, details });
  }
}
