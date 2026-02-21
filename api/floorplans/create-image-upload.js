import { getAdminClient } from "../_lib/supabaseAdmin.js";
import { requireProfile } from "../_lib/auth.js";
import { ApiError, parseJsonBody, sendJson } from "../_lib/http.js";

const sanitize = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "");

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

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    let admin;
    try {
      admin = getAdminClient();
    } catch (envErr) {
      throw new ApiError(500, envErr.message || "Server environment is misconfigured.");
    }

    await requireProfile(req, admin, { roles: ["admin"], requireActive: true });
    const body = await parseJsonBody(req);

    const clientId = String(body?.clientId || "").trim();
    const fileName = String(body?.fileName || "").trim();
    const contentType = String(body?.contentType || "").trim() || "image/png";

    if (!clientId) throw new ApiError(400, "clientId is required.");
    if (!contentType.startsWith("image/")) throw new ApiError(400, "contentType must be an image type.");

    const ext = extFromName(fileName) || extFromType(contentType) || "png";
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const path = `${sanitize(clientId)}/${unique}.${sanitize(ext) || "png"}`;

    const { data, error } = await admin.storage
      .from("floorplan-images")
      .createSignedUploadUrl(path);

    if (error || !data?.token || !data?.path) {
      console.error("[api/floorplans/create-image-upload] createSignedUploadUrl failed", { clientId, error });
      throw new ApiError(500, "Failed to prepare upload URL.", error?.message || null);
    }

    return sendJson(res, 200, {
      ok: true,
      upload: {
        bucket: "floorplan-images",
        path: data.path,
        token: data.token,
        signedUrl: data.signedUrl,
        contentType,
      },
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : "Internal server error.";
    const details = error instanceof ApiError ? error.details : null;
    console.error("[api/floorplans/create-image-upload] request failed", error);
    return sendJson(res, status, { error: message, details });
  }
}
