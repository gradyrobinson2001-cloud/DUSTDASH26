import { getAdminClient } from "../_lib/supabaseAdmin.js";
import { requireProfile } from "../_lib/auth.js";
import { ApiError, parseJsonBody, sendJson } from "../_lib/http.js";

const asStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v || "").trim())
    .filter(Boolean);
};

const snapshotProfile = (job) => ({
  id: job?.client_id || `job-${job?.id || Date.now()}`,
  name: job?.client_name || "Client",
  address: job?.suburb ? `${job.suburb}, QLD` : "",
  suburb: job?.suburb || "",
  notes: job?.notes || "",
  access_notes: "",
  frequency: "",
  preferred_day: "",
  preferred_time: "",
  bedrooms: null,
  bathrooms: null,
  living: null,
  kitchen: null,
  email: "",
  phone: "",
  source: "job_snapshot",
});

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
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

    let jobsQuery = admin
      .from("scheduled_jobs")
      .select("id, client_id, client_name, suburb, notes, assigned_staff, is_published")
      .in("id", jobIds);

    // Staff can only fetch profiles for jobs assigned to them and published to rota.
    if (profile.role === "staff") {
      jobsQuery = jobsQuery.contains("assigned_staff", [user.id]).eq("is_published", true);
    }

    const { data: jobs, error: jobsError } = await jobsQuery;
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
    }

    const profilesByJob = {};
    for (const job of jobRows) {
      const client = clientsById[String(job.client_id || "")];
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
