import { getAdminClient } from "../_lib/supabaseAdmin.js";
import { requireProfile } from "../_lib/auth.js";
import { ApiError, parseJsonBody, sendJson } from "../_lib/http.js";
import { runApiSecurity } from "../_lib/security.js";

const asStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v || "").trim())
    .filter(Boolean);
};

const normalize = (value) => String(value || "").trim().toLowerCase();

const isMissingColumnError = (error) => {
  const code = String(error?.code || "");
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return code === "42703" || message.includes("column") || message.includes("does not exist");
};

const snapshotProfile = (job) => ({
  id: job?.client_id || `job-${job?.id || Date.now()}`,
  name: job?.client_name || "Client",
  address: job?.address || (job?.suburb ? `${job.suburb}, QLD` : ""),
  suburb: job?.suburb || "",
  notes: job?.notes || "",
  access_notes: job?.access_notes || job?.accessNotes || "",
  frequency: job?.frequency || "",
  preferred_day: job?.preferred_day || job?.preferredDay || "",
  preferred_time: job?.preferred_time || job?.preferredTime || "",
  bedrooms: job?.bedrooms ?? null,
  bathrooms: job?.bathrooms ?? null,
  living: job?.living ?? null,
  kitchen: job?.kitchen ?? null,
  email: job?.email || "",
  phone: job?.phone || "",
  source: "job_snapshot",
});

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    runApiSecurity(req, { rateLimitKey: "staff:job-client-profiles", max: 240, windowMs: 5 * 60_000 });
    let admin;
    try {
      admin = getAdminClient();
    } catch (envErr) {
      throw new ApiError(500, envErr.message || "Server environment is misconfigured.");
    }

    const { user, profile } = await requireProfile(req, admin, { roles: ["admin", "staff"], requireActive: true });
    const body = await parseJsonBody(req);
    const jobIds = asStringArray(body?.jobIds).slice(0, 100);

    if (jobIds.length === 0) {
      return sendJson(res, 200, { ok: true, profilesByJob: {} });
    }

    const basicJobSelect = "id, client_id, client_name, suburb, notes, assigned_staff, is_published";
    const extendedJobSelect = `${basicJobSelect}, address, access_notes, frequency, preferred_day, preferred_time, bedrooms, bathrooms, living, kitchen, email, phone`;
    let jobsQuery = admin
      .from("scheduled_jobs")
      .select(extendedJobSelect)
      .in("id", jobIds);

    // Staff can only fetch profiles for jobs assigned to them and published to rota.
    if (profile.role === "staff") {
      jobsQuery = jobsQuery.contains("assigned_staff", [user.id]).eq("is_published", true);
    }

    let { data: jobs, error: jobsError } = await jobsQuery;
    if (jobsError && isMissingColumnError(jobsError)) {
      let basicQuery = admin
        .from("scheduled_jobs")
        .select(basicJobSelect)
        .in("id", jobIds);
      if (profile.role === "staff") {
        basicQuery = basicQuery.contains("assigned_staff", [user.id]).eq("is_published", true);
      }
      const fallbackJobs = await basicQuery;
      jobs = fallbackJobs.data;
      jobsError = fallbackJobs.error;
    }
    if (jobsError) {
      console.error("[api/staff/job-client-profiles] jobs query failed", { userId: user.id, jobsError });
      throw new ApiError(500, "Failed to load jobs.", jobsError.message);
    }

    const jobRows = Array.isArray(jobs) ? jobs : [];
    const clientIds = Array.from(
      new Set(
        jobRows
          .map((job) => String(job?.client_id || "").trim())
          .filter(Boolean)
      )
    );

    let clientsById = {};
    let fallbackClients = [];
    if (clientIds.length > 0) {
      const { data: clients, error: clientsError } = await admin
        .from("clients")
        .select("id, name, email, phone, address, suburb, notes, access_notes, frequency, preferred_day, preferred_time, bedrooms, bathrooms, living, kitchen")
        .in("id", clientIds);

      if (clientsError) {
        console.error("[api/staff/job-client-profiles] clients query failed", { userId: user.id, clientsError });
        throw new ApiError(500, "Failed to load client profiles.", clientsError.message);
      }

      clientsById = (clients || []).reduce((acc, row) => {
        acc[String(row.id)] = row;
        return acc;
      }, {});
      fallbackClients = [...(clients || [])];
    }

    const jobsMissingClientId = jobRows.filter((job) => !String(job?.client_id || "").trim() && normalize(job?.client_name));
    if (jobsMissingClientId.length > 0) {
      const uniqueSuburbs = Array.from(
        new Set(
          jobsMissingClientId.map((job) => String(job?.suburb || "").trim()).filter(Boolean)
        )
      );

      let fallbackQuery = admin
        .from("clients")
        .select("id, name, email, phone, address, suburb, notes, access_notes, frequency, preferred_day, preferred_time, bedrooms, bathrooms, living, kitchen");
      if (uniqueSuburbs.length > 0) {
        fallbackQuery = fallbackQuery.in("suburb", uniqueSuburbs);
      }

      const { data: fallbackRows, error: fallbackError } = await fallbackQuery.limit(500);
      if (fallbackError) {
        console.error("[api/staff/job-client-profiles] fallback clients query failed", { userId: user.id, fallbackError });
        throw new ApiError(500, "Failed to match fallback client profiles.", fallbackError.message);
      }
      fallbackClients = [...fallbackClients, ...(fallbackRows || [])];
    }

    const profilesByJob = {};
    for (const job of jobRows) {
      let client = clientsById[String(job.client_id || "")];
      if (!client) {
        const jobName = normalize(job?.client_name);
        const jobSuburb = normalize(job?.suburb);
        const byNameSuburb = fallbackClients.find((row) => (
          normalize(row?.name) === jobName &&
          (!jobSuburb || normalize(row?.suburb) === jobSuburb)
        ));
        const byNameOnly = fallbackClients.find((row) => normalize(row?.name) === jobName);
        client = byNameSuburb || byNameOnly || null;
      }

      profilesByJob[String(job.id)] = client
        ? { ...client, source: "client" }
        : snapshotProfile(job);
    }

    return sendJson(res, 200, { ok: true, profilesByJob });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : "Internal server error.";
    const details = error instanceof ApiError ? error.details : null;
    console.error("[api/staff/job-client-profiles] request failed", error);
    return sendJson(res, status, { error: message, details });
  }
}
