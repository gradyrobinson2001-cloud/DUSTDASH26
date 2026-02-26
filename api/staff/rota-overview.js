import { getAdminClient } from "../_lib/supabaseAdmin.js";
import { requireProfile } from "../_lib/auth.js";
import { ApiError, parseJsonBody, sendJson } from "../_lib/http.js";
import { runApiSecurity } from "../_lib/security.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value) => UUID_RE.test(String(value || "").trim());
const normalize = (value) => String(value || "").trim().toLowerCase();
const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
const isMissingColumnError = (error) => {
  const code = String(error?.code || "");
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return code === "42703" || message.includes("column") || message.includes("does not exist");
};

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

function chooseFallbackClientForJob(job, candidates) {
  const rows = Array.isArray(candidates) ? candidates : [];
  if (!rows.length) return null;
  const jobName = normalize(job?.client_name);
  const jobSuburb = normalize(job?.suburb);
  const jobAddress = normalize(job?.address);
  const jobEmail = normalize(job?.email);
  const jobPhone = normalizePhone(job?.phone);

  if (jobEmail) {
    const byEmail = rows.find((row) => normalize(row?.email) === jobEmail);
    if (byEmail) return byEmail;
  }
  if (jobPhone) {
    const byPhone = rows.find((row) => normalizePhone(row?.phone) === jobPhone);
    if (byPhone) return byPhone;
  }
  if (jobAddress) {
    const byAddress = rows.find((row) => normalize(row?.address) === jobAddress);
    if (byAddress) return byAddress;
  }
  if (jobName) {
    const byNameSuburb = rows.find((row) => (
      normalize(row?.name) === jobName &&
      (!jobSuburb || normalize(row?.suburb) === jobSuburb)
    ));
    if (byNameSuburb) return byNameSuburb;
    const byNameOnly = rows.find((row) => normalize(row?.name) === jobName);
    if (byNameOnly) return byNameOnly;
  }
  if (jobSuburb) {
    const suburbMatches = rows.filter((row) => normalize(row?.suburb) === jobSuburb);
    if (suburbMatches.length === 1) return suburbMatches[0];
  }
  return null;
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

    const basicJobSelect = "id, date, client_id, client_name, suburb, start_time, end_time, duration, assigned_staff, is_published, is_break";
    const extendedJobSelect = `${basicJobSelect}, address, email, phone`;
    let jobsQuery = admin
      .from("scheduled_jobs")
      .select(extendedJobSelect)
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .eq("is_published", true)
      .or("is_break.is.null,is_break.eq.false")
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });
    let { data: jobs, error: jobsError } = await jobsQuery;
    if (jobsError && isMissingColumnError(jobsError)) {
      let basicQuery = admin
        .from("scheduled_jobs")
        .select(basicJobSelect)
        .gte("date", weekStart)
        .lte("date", weekEnd)
        .eq("is_published", true)
        .or("is_break.is.null,is_break.eq.false")
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });
      const fallbackJobs = await basicQuery;
      jobs = fallbackJobs.data;
      jobsError = fallbackJobs.error;
    }

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
    const validClientIds = clientIds.filter(isUuid);

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
    let fallbackClients = [];
    if (validClientIds.length > 0) {
      const { data: clientRows, error: clientError } = await admin
        .from("clients")
        .select("id, name, email, phone, address, suburb, notes, access_notes, frequency, preferred_day, preferred_time, bedrooms, bathrooms, living, kitchen")
        .in("id", validClientIds);

      if (clientError) {
        console.error("[api/staff/rota-overview] clients query failed", clientError);
        throw new ApiError(500, "Failed to load client details.", clientError.message);
      }

      clientsById = (clientRows || []).reduce((acc, row) => {
        acc[String(row.id)] = row;
        return acc;
      }, {});
      fallbackClients = [...(clientRows || [])];
    }

    const jobsMissingClientId = rows.filter((job) => {
      const jobClientId = String(job?.client_id || "").trim();
      return (!jobClientId || !isUuid(jobClientId)) && normalize(job?.client_name);
    });
    if (jobsMissingClientId.length > 0) {
      const uniqueSuburbs = Array.from(new Set(
        jobsMissingClientId.map((job) => String(job?.suburb || "").trim()).filter(Boolean)
      ));
      let fallbackQuery = admin
        .from("clients")
        .select("id, name, email, phone, address, suburb, notes, access_notes, frequency, preferred_day, preferred_time, bedrooms, bathrooms, living, kitchen");
      if (uniqueSuburbs.length > 0) {
        fallbackQuery = fallbackQuery.in("suburb", uniqueSuburbs);
      }
      const { data: fallbackRows, error: fallbackError } = await fallbackQuery.limit(500);
      if (fallbackError) {
        console.error("[api/staff/rota-overview] fallback clients query failed", fallbackError);
        throw new ApiError(500, "Failed to match fallback client profiles.", fallbackError.message);
      }
      fallbackClients = [...fallbackClients, ...(fallbackRows || [])];
    }

    const enrichedJobs = rows.map((job) => {
      const byId = clientsById[String(job?.client_id || "")] || null;
      const client = byId || chooseFallbackClientForJob(job, fallbackClients);
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
