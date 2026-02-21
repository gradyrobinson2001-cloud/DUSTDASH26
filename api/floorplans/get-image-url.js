import { getAdminClient } from "../_lib/supabaseAdmin.js";
import { requireProfile } from "../_lib/auth.js";
import { ApiError, parseJsonBody, sendJson } from "../_lib/http.js";

const PATH_RE = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/;

function parseClientPrefix(path) {
  return String(path || "").split("/")[0] || "";
}

function isValidFloorplanPath(value) {
  const path = String(value || "").trim();
  if (!path) return false;
  if (path.includes("..")) return false;
  return PATH_RE.test(path);
}

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
    const storagePath = String(body?.storagePath || "").trim();
    const clientId = String(body?.clientId || "").trim();

    if (!isValidFloorplanPath(storagePath)) {
      throw new ApiError(400, "Invalid storage path.");
    }
    if (clientId && parseClientPrefix(storagePath) !== clientId) {
      throw new ApiError(403, "Path does not match client.");
    }

    const { data, error } = await admin.storage
      .from("floorplan-images")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
    if (error || !data?.signedUrl) {
      throw new ApiError(500, "Failed to generate signed URL.", error?.message || null);
    }

    return sendJson(res, 200, { ok: true, signedUrl: data.signedUrl });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : "Internal server error.";
    const details = error instanceof ApiError ? error.details : null;
    console.error("[api/floorplans/get-image-url] request failed", error);
    return sendJson(res, status, { error: message, details });
  }
}
