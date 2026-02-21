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

    const { user } = await requireProfile(req, admin, { roles: ["admin", "staff"], requireActive: true });
    const body = await parseJsonBody(req);

    const jobId = String(body.jobId || "").trim();
    const clientId = body.clientId == null ? null : String(body.clientId).trim();
    const dateInput = String(body.date || "").trim();
    const date = DATE_RE.test(dateInput) ? dateInput : new Date().toISOString().split("T")[0];
    const type = body.type === "after" ? "after" : "before";
    const fileName = String(body.fileName || "").trim();
    const contentType = String(body.contentType || "").trim() || "image/jpeg";

    if (!jobId) throw new ApiError(400, "jobId is required.");

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
        client_id: clientId,
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
