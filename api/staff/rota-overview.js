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

function mondayFrom(dateValue) {
  const d = new Date(`${dateValue}T00:00:00.000Z`);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().split("T")[0];
}

function addDays(dateValue, days) {
  const d = new Date(`${dateValue}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    runApiSecurity(req, { rateLimitKey: "staff:rota-overview", max: 240, windowMs: 5 * 60_000 });
    let admin;
    try {
      admin = getAdminClient();
    } catch (envErr) {
      throw new ApiError(500, envErr.message || "Server environment is misconfigured.");
    }

    await requireProfile(req, admin, { roles: ["admin", "staff"], requireActive: true });

    const body = await parseJsonBody(req);
    const rawWeekStart = toIsoDate(String(body?.weekStart || "")) || new Date().toISOString().split("T")[0];
    const weekStart = mondayFrom(rawWeekStart);
    const weekEnd = addDays(weekStart, 6);

    const { data: jobs, error: jobsError } = await admin
      .from("scheduled_jobs")
      .select("id, date, client_id, client_name, suburb, start_time, end_time, duration, assigned_staff, is_published, is_break")
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .eq("is_published", true)
      .or("is_break.is.null,is_break.eq.false")
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (jobsError) {
      console.error("[api/staff/rota-overview] jobs query failed", jobsError);
      throw new ApiError(500, "Failed to load rota jobs.", jobsError.message);
    }

    const rows = Array.isArray(jobs) ? jobs : [];
    const staffIds = Array.from(new Set(
      rows.flatMap(job => Array.isArray(job?.assigned_staff) ? job.assigned_staff.map(String) : [])
    ));
    const clientIds = Array.from(new Set(
      rows.map((job) => String(job?.client_id || "").trim()).filter(Boolean)
    ));

    let staffById = {};
    if (staffIds.length > 0) {
      const { data: staffRows, error: staffError } = await admin
        .from("profiles")
        .select("id, full_name, role")
        .in("id", staffIds);

      if (staffError) {
        console.error("[api/staff/rota-overview] staff query failed", staffError);
        throw new ApiError(500, "Failed to load staff roster.", staffError.message);
      }

      staffById = (staffRows || []).reduce((acc, row) => {
        acc[String(row.id)] = row;
        return acc;
      }, {});
    }

    let clientsById = {};
    if (clientIds.length > 0) {
      const { data: clientRows, error: clientError } = await admin
        .from("clients")
        .select("id, name, email, phone, address, suburb, notes, access_notes, frequency, preferred_day, preferred_time, bedrooms, bathrooms, living, kitchen")
        .in("id", clientIds);

      if (clientError) {
        console.error("[api/staff/rota-overview] clients query failed", clientError);
        throw new ApiError(500, "Failed to load client details.", clientError.message);
      }

      clientsById = (clientRows || []).reduce((acc, row) => {
        acc[String(row.id)] = row;
        return acc;
      }, {});
    }

    const enrichedJobs = rows.map((job) => {
      const client = clientsById[String(job?.client_id || "")] || null;
      return {
        ...job,
        client_name: client?.name || job?.client_name || "",
        client_profile: client,
      };
    });

    return sendJson(res, 200, {
      ok: true,
      weekStart,
      weekEnd,
      jobs: enrichedJobs,
      staffById,
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : "Internal server error.";
    const details = error instanceof ApiError ? error.details : null;
    console.error("[api/staff/rota-overview] request failed", error);
    return sendJson(res, status, { error: message, details });
  }
}
