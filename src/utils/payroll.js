// ═══════════════════════════════════════════════════════════
// ATO Payroll Calculations — 2024-25 (NAT 1008, Scale 1)
// Verify with your accountant before first live payroll run.
// ═══════════════════════════════════════════════════════════

// Weekly withholding: withholding = (a × grossWeekly) − b
// Source: ATO NAT 1008 Tax Withheld Calculator Scale 1, 2024-25
const TAX_BRACKETS_WEEKLY = [
  { maxWeekly: 359,      a: 0.1900, b: 0 },
  { maxWeekly: 438,      a: 0.2348, b: 16.05 },
  { maxWeekly: 548,      a: 0.2190, b: 9.31 },
  { maxWeekly: 721,      a: 0.3477, b: 79.80 },
  { maxWeekly: 865,      a: 0.3450, b: 77.85 },
  { maxWeekly: 1282,     a: 0.3900, b: 117.68 },
  { maxWeekly: 1730,     a: 0.4650, b: 213.81 },
  { maxWeekly: 3461,     a: 0.4900, b: 256.91 },
  { maxWeekly: Infinity, a: 0.4947, b: 273.13 },
];

/**
 * Calculate weekly PAYG withholding (rounded to nearest dollar).
 * @param {number} grossWeekly — gross weekly earnings (before super, after tax allowances)
 * @returns {number} tax withheld for the week
 */
export function calcWeeklyTax(grossWeekly) {
  if (grossWeekly <= 0) return 0;
  const bracket = TAX_BRACKETS_WEEKLY.find(b => grossWeekly <= b.maxWeekly);
  if (!bracket) return 0;
  const raw = (bracket.a * grossWeekly) - bracket.b;
  return Math.max(0, Math.round(raw));
}

/**
 * Calculate full payroll breakdown for one staff member for one week.
 *
 * @param {object} params
 * @param {number} params.hoursWorked       — regular hours worked (excl. travel)
 * @param {number} params.travelHours       — travel hours (if paid separately)
 * @param {number} params.hourlyRate        — $/hr
 * @param {number} [params.travelRate]      — $/hr for travel (defaults to hourlyRate)
 * @param {number} [params.travelAllowance] — flat travel allowance on top (default 0)
 * @param {number} [params.superRate]       — super rate decimal, default 0.12 (12% from 1 July 2025)
 * @param {string} [params.employmentType]  — 'casual'|'part_time'|'full_time'
 *
 * @returns {{ grossPay, taxWithheld, superAmount, netPay, effectiveTaxRate }}
 */
export function calcPayrollBreakdown({
  hoursWorked = 0,
  travelHours = 0,
  hourlyRate = 0,
  travelRate,
  travelAllowance = 0,
  superRate = 0.12,
  employmentType = 'casual',
}) {
  const effectiveTravelRate = travelRate ?? hourlyRate;

  // Gross = regular hours + travel hours (at travel rate) + flat allowance
  const grossPay = (hoursWorked * hourlyRate)
    + (travelHours * effectiveTravelRate)
    + travelAllowance;

  // Casual loading is already assumed baked into hourly rate by the employer.
  // ATO: withholding is calculated on the full gross earnings.
  const weeklyTaxableGross = grossPay; // single-week payroll
  const taxWithheld = calcWeeklyTax(weeklyTaxableGross);

  // Super: 12% on top of gross (employer contribution, not deducted from net)
  const superAmount = Math.round(grossPay * superRate * 100) / 100;

  // Net pay = gross − tax withheld
  const netPay = Math.max(0, grossPay - taxWithheld);

  const effectiveTaxRate = grossPay > 0 ? (taxWithheld / grossPay) : 0;

  return {
    grossPay:       Math.round(grossPay     * 100) / 100,
    taxWithheld:    Math.round(taxWithheld  * 100) / 100,
    superAmount:    Math.round(superAmount  * 100) / 100,
    netPay:         Math.round(netPay       * 100) / 100,
    effectiveTaxRate,
  };
}

/**
 * Convert one clock-in/out entry into payable worked minutes after break deduction.
 *
 * @param {object} entry
 * @param {boolean} [includeOpenShift=false] include running shifts without clock_out
 * @returns {number}
 */
export function calcWorkedMinutesFromEntry(entry, includeOpenShift = false) {
  if (!entry) return 0;
  const clockInAt = entry.clock_in_at ?? entry.clockInAt ?? null;
  const clockOutAt = entry.clock_out_at ?? entry.clockOutAt ?? null;
  if (!clockInAt) return 0;

  const startMs = new Date(clockInAt).getTime();
  if (Number.isNaN(startMs)) return 0;

  let endMs = clockOutAt ? new Date(clockOutAt).getTime() : NaN;
  if (Number.isNaN(endMs)) {
    if (!includeOpenShift) return 0;
    endMs = Date.now();
  }

  if (endMs <= startMs) return 0;

  const grossMinutes = Math.round((endMs - startMs) / 60000);
  const breakMinutes = Math.max(0, Number(entry.break_minutes ?? entry.breakMinutes ?? 30) || 0);
  return Math.max(0, grossMinutes - breakMinutes);
}

/**
 * Aggregate actual_duration (minutes) from completed jobs for a staff member
 * in a given week.
 *
 * @param {Array}  jobs         — all scheduled_jobs rows
 * @param {string} staffId      — profile ID of the staff member
 * @param {string} weekStart    — 'YYYY-MM-DD' (Monday)
 * @param {Array}  [timeEntries]— optional staff_time_entries rows
 * @returns {{ hoursWorked, completedJobs, scheduledJobs }}
 */
export function calcHoursFromJobs(jobs, staffId, weekStart, timeEntries = []) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  const staffJobs = jobs.filter(j => {
    const jDate = j.date;
    const assignedStaff = Array.isArray(j.assigned_staff) ? j.assigned_staff.map(String) : [];
    const isPublished = Boolean(j.is_published ?? j.isPublished ?? false);
    return assignedStaff.includes(String(staffId))
      && isPublished
      && jDate >= weekStart
      && jDate <= weekEndStr
      && !j.is_break && !j.isBreak;
  });

  const completedJobs = staffJobs.filter(j => {
    const status = j.status || j.job_status || j.jobStatus;
    return status === 'completed';
  });

  const totalScheduledMins = staffJobs.reduce(
    (sum, j) => sum + (j.duration || 0), 0
  );

  const totalActualMins = completedJobs.reduce(
    (sum, j) => sum + (j.actual_duration || j.actualDuration || j.duration || 0), 0
  );

  const staffClockEntries = (Array.isArray(timeEntries) ? timeEntries : []).filter((entry) => {
    const entryStaffId = String(entry.staff_id ?? entry.staffId ?? '');
    const workDate = entry.work_date ?? entry.workDate;
    return entryStaffId === String(staffId) &&
      typeof workDate === 'string' &&
      workDate >= weekStart &&
      workDate <= weekEndStr;
  });

  const totalClockMins = staffClockEntries.reduce(
    (sum, entry) => sum + calcWorkedMinutesFromEntry(entry, false), 0
  );

  const scheduledHours = Math.round(totalScheduledMins / 60 * 100) / 100;
  const completedHours = Math.round(totalActualMins / 60 * 100) / 100;
  const clockHours = Math.round(totalClockMins / 60 * 100) / 100;
  const hasClockData = staffClockEntries.some((entry) => Boolean(entry.clock_in_at ?? entry.clockInAt));
  const useActual = hasClockData || completedJobs.length > 0;

  return {
    // Preferred source order:
    // 1) explicit staff clock in/out entries
    // 2) completed job durations
    // 3) published scheduled durations
    hoursWorked: hasClockData ? clockHours : (useActual ? completedHours : scheduledHours),
    hoursSource: hasClockData
      ? 'clock_timesheet'
      : (useActual ? 'actual_completed_jobs' : 'published_rota_schedule'),
    completedJobs: completedJobs.length,
    scheduledJobs: staffJobs.length,
    clockEntries: staffClockEntries.length,
    scheduledHours,
    completedHours,
    clockHours,
    totalScheduledMinutes: totalScheduledMins,
    totalMinutes: hasClockData ? totalClockMins : totalActualMins,
  };
}

// ─── Format helpers ──────────────────────────────────────
export function fmtCurrency(n) {
  return `$${(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtPercent(r) {
  return `${(r * 100).toFixed(1)}%`;
}

export function getWeekLabel(weekStart) {
  const d = new Date(weekStart);
  const sun = new Date(weekStart);
  sun.setDate(d.getDate() + 6);
  return `${d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${sun.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
