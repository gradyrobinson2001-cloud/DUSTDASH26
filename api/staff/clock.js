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

function clampBreakMinutes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 30;
  return Math.max(0, Math.min(180, Math.round(n)));
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function calcWorkedMinutes(entry) {
  const clockInAt = entry?.clock_in_at;
  const clockOutAt = entry?.clock_out_at;
  if (!clockInAt || !clockOutAt) return 0;
  const startMs = new Date(clockInAt).getTime();
  const endMs = new Date(clockOutAt).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return 0;
  const grossMinutes = Math.round((endMs - startMs) / 60000);
  const breakMinutes = clampBreakMinutes(entry?.break_minutes);
  return Math.max(0, grossMinutes - breakMinutes);
}

function isMissingOnConflictConstraint(err) {
  const code = String(err?.code || "");
  const message = String(err?.message || "").toLowerCase();
  return code === "42P10" || message.includes("no unique or exclusion constraint matching the on conflict");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    runApiSecurity(req, { rateLimitKey: "staff:clock", max: 240, windowMs: 5 * 60_000 });
    let admin;
    try {
      admin = getAdminClient();
    } catch (envErr) {
      throw new ApiError(500, envErr.message || "Server environment is misconfigured.");
    }

    const { profile } = await requireProfile(req, admin, { roles: ["admin", "staff"], requireActive: true });
    const body = await parseJsonBody(req);

    const rawAction = String(body?.action || "").trim().toLowerCase();
    // Backward compatibility:
    // if caller sends list-style payload without action, treat it as "list".
    const action = rawAction || ((body?.weekStart || body?.staffId) ? "list" : "");
    if (!["clock_in", "clock_out", "set_break", "list"].includes(action)) {
      throw new ApiError(400, "Invalid action. Use clock_in, clock_out, set_break, or list.");
    }

    if (action === "list") {
      const weekStart = toIsoDate(String(body?.weekStart || "").trim());
      const requestedStaffId = body?.staffId == null ? null : String(body.staffId).trim();
      // Admin with no staffId → return ALL staff entries; staff → only own entries
      const targetStaffId = profile.role === "admin"
        ? (requestedStaffId || null)
        : profile.id;

      let query = admin
        .from("staff_time_entries")
        .select("*")
        .order("work_date", { ascending: false })
        .order("clock_in_at", { ascending: false });

      if (targetStaffId) query = query.eq("staff_id", targetStaffId);
      if (weekStart) query = query.gte("work_date", weekStart).lte("work_date", addDays(weekStart, 6));

      const { data, error } = await query;
      if (error) throw new ApiError(500, "Failed to load clock entries.", error.message);
      return sendJson(res, 200, { ok: true, action, entries: data || [] });
    }

    const targetStaffId = profile.role === "admin" && body?.staffId
      ? String(body.staffId)
      : profile.id;

    const workDate = toIsoDate(String(body?.workDate || "")) || new Date().toISOString().split("T")[0];
    const breakMinutes = clampBreakMinutes(body?.breakMinutes);
    const now = new Date().toISOString();

    const { data: existingRows, error: existingError } = await admin
      .from("staff_time_entries")
      .select("*")
      .eq("staff_id", targetStaffId)
      .eq("work_date", workDate)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(10);
    if (existingError) throw new ApiError(500, "Failed to load clock entry.", existingError.message);

    const rows = Array.isArray(existingRows) ? existingRows : [];
    const openEntry = rows.find((row) => row?.clock_in_at && !row?.clock_out_at) || null;
    const closedEntry = rows.find((row) => row?.clock_in_at && row?.clock_out_at) || null;
    const draftEntry = rows.find((row) => !row?.clock_in_at) || null;

    if (rows.length > 1) {
      console.warn("[api/staff/clock] duplicate entries detected for staff/date", {
        staffId: targetStaffId,
        workDate,
        count: rows.length,
      });
    }

    let entry = openEntry || closedEntry || draftEntry || null;

    if (action === "clock_in") {
      if (entry?.clock_in_at && entry?.clock_out_at) {
        throw new ApiError(409, "You have already clocked out for this day.");
      }
      if (entry?.clock_in_at && !entry?.clock_out_at) {
        return sendJson(res, 200, {
          ok: true,
          action,
          status: "already_clocked_in",
          entry: { ...entry, worked_minutes: calcWorkedMinutes(entry) },
        });
      }

      const payload = {
        staff_id: targetStaffId,
        work_date: workDate,
        clock_in_at: now,
        clock_out_at: null,
        break_minutes: breakMinutes,
        source: "staff_portal",
        updated_at: now,
      };

      if (entry?.id) {
        const { data, error } = await admin
          .from("staff_time_entries")
          .update(payload)
          .eq("id", entry.id)
          .select("*")
          .single();
        if (error) throw new ApiError(500, "Failed to clock in.", error.message);
        entry = data;
      } else {
        const { data, error } = await admin
          .from("staff_time_entries")
          .upsert(payload, { onConflict: "staff_id,work_date" })
          .select("*")
          .single();

        if (error) {
          if (!isMissingOnConflictConstraint(error)) {
            throw new ApiError(500, "Failed to clock in.", error.message);
          }
          const fallbackInsert = await admin
            .from("staff_time_entries")
            .insert(payload)
            .select("*")
            .single();
          if (fallbackInsert.error) {
            throw new ApiError(500, "Failed to clock in.", fallbackInsert.error.message);
          }
          entry = fallbackInsert.data;
        } else {
          entry = data;
        }
      }
    }

    if (action === "clock_out") {
      if (!entry?.clock_in_at) {
        throw new ApiError(409, "You need to clock in first.");
      }
      if (entry?.clock_out_at) {
        return sendJson(res, 200, {
          ok: true,
          action,
          status: "already_clocked_out",
          entry: { ...entry, worked_minutes: calcWorkedMinutes(entry) },
        });
      }

      const { data, error } = await admin
        .from("staff_time_entries")
        .update({
          clock_out_at: now,
          break_minutes: breakMinutes,
          updated_at: now,
        })
        .eq("id", entry.id)
        .select("*")
        .single();
      if (error) throw new ApiError(500, "Failed to clock out.", error.message);
      entry = data;
    }

    if (action === "set_break") {
      if (!entry) {
        const { data, error } = await admin
          .from("staff_time_entries")
          .insert({
            staff_id: targetStaffId,
            work_date: workDate,
            break_minutes: breakMinutes,
            source: "staff_portal",
            updated_at: now,
          })
          .select("*")
          .single();
        if (error) throw new ApiError(500, "Failed to create break entry.", error.message);
        entry = data;
      } else {
        const { data, error } = await admin
          .from("staff_time_entries")
          .update({ break_minutes: breakMinutes, updated_at: now })
          .eq("id", entry.id)
          .select("*")
          .single();
        if (error) throw new ApiError(500, "Failed to update break.", error.message);
        entry = data;
      }
    }

    return sendJson(res, 200, {
      ok: true,
      action,
      status: "ok",
      entry: { ...entry, worked_minutes: calcWorkedMinutes(entry) },
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : "Internal server error.";
    const details = error instanceof ApiError ? error.details : null;
    console.error("[api/staff/clock] request failed", error);
    return sendJson(res, status, { error: message, details });
  }
}
