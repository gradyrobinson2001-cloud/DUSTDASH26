import { getAdminClient } from "../_lib/supabaseAdmin.js";
import { requireProfile } from "../_lib/auth.js";
import { ApiError, parseJsonBody, sendJson } from "../_lib/http.js";
import { runApiSecurity } from "../_lib/security.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toIsoDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return value;
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    runApiSecurity(req, { rateLimitKey: "staff:clock-list", max: 300, windowMs: 5 * 60_000 });
    let admin;
    try {
      admin = getAdminClient();
    } catch (envErr) {
      throw new ApiError(500, envErr.message || "Server environment is misconfigured.");
    }

    const { profile } = await requireProfile(req, admin, { roles: ["admin", "staff"], requireActive: true });
    const body = await parseJsonBody(req);

    const weekStart = toIsoDate(String(body?.weekStart || "").trim());
    const requestedStaffId = body?.staffId == null ? null : String(body.staffId).trim();
    const targetStaffId = profile.role === "admin" && requestedStaffId ? requestedStaffId : profile.id;

    let query = admin
      .from("staff_time_entries")
      .select("*")
      .order("work_date", { ascending: false })
      .order("clock_in_at", { ascending: false });

    if (targetStaffId) query = query.eq("staff_id", targetStaffId);
    if (weekStart) query = query.gte("work_date", weekStart).lte("work_date", addDays(weekStart, 6));

    const { data, error } = await query;
    if (error) {
      throw new ApiError(500, "Failed to load clock entries.", error.message);
    }

    return sendJson(res, 200, { ok: true, entries: data || [] });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : "Internal server error.";
    const details = error instanceof ApiError ? error.details : null;
    console.error("[api/staff/clock-list] request failed", error);
    return sendJson(res, status, { error: message, details });
  }
}
