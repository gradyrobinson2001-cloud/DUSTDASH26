import React, { useState, useMemo, useCallback } from 'react';
import emailjs from '@emailjs/browser';
import { jsPDF } from 'jspdf';
import { T } from '../shared';
import { useProfiles }      from '../hooks/useProfiles';
import { usePayroll }       from '../hooks/usePayroll';
import { useScheduledJobs } from '../hooks/useScheduledJobs';
import { useStaffTimeEntries } from '../hooks/useStaffTimeEntries';
import { calcPayrollBreakdown, calcHoursFromJobs, fmtCurrency, fmtPercent, getWeekLabel } from '../utils/payroll';

// ═══════════════════════════════════════════════════════════
// PAYROLL TAB — Phase 5
// Weekly payroll run: calculate → review → process → payslips
// ATO NAT 1008 Scale 1 tax (2024-25)
// Super at 12% on top of gross (from 1 July 2025)
// ═══════════════════════════════════════════════════════════

const TODAY = new Date().toISOString().split('T')[0];
const EMAILJS_SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_UNIVERSAL_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_UNIVERSAL_TEMPLATE_ID;
const EMAILJS_PAYROLL_TEMPLATE_ID =
  EMAILJS_UNIVERSAL_TEMPLATE_ID ||
  import.meta.env.VITE_EMAILJS_PAYROLL_TEMPLATE_ID ||
  EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const BUSINESS_NAME       = import.meta.env.VITE_BUSINESS_NAME || 'Dust Bunnies Cleaning';
const BUSINESS_ABN        = import.meta.env.VITE_BUSINESS_ABN || '';
const BUSINESS_EMAIL      = import.meta.env.VITE_BUSINESS_EMAIL || '';
const SUPER_FUND_NAME     = import.meta.env.VITE_SUPER_FUND_NAME || 'Configured by employer';
const SUPER_FUND_NUMBER   = import.meta.env.VITE_SUPER_FUND_NUMBER || import.meta.env.VITE_SUPER_FUND_USI || '';
const DEFAULT_SUPER_RATE  = 0.12;

function getMonday(dateStr) {
  const d = new Date(dateStr);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().split('T')[0];
}
function prevMonday(m) { const d = new Date(m); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; }
function nextMonday(m) { const d = new Date(m); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0]; }
function getSunday(mondayStr) { const d = new Date(mondayStr); d.setDate(d.getDate() + 6); return d; }
function fmtDate(dateValue, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(dateValue).toLocaleDateString('en-AU', options);
}
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function buildPayslipData(staff, rec, weekStart) {
  const periodStart = new Date(weekStart);
  const periodEnd = getSunday(weekStart);
  const processedAt = rec?.processed_at || rec?.processedAt || rec?.updated_at || rec?.updatedAt || new Date().toISOString();
  const paymentDate = new Date(processedAt);

  const hours = num(rec?.hoursWorked ?? rec?.hours_worked);
  const rate = num(rec?.hourlyRate ?? rec?.hourly_rate);
  const travel = num(rec?.travelAllowance ?? rec?.travel_allowance);
  const gross = num(rec?.grossPay ?? rec?.gross_pay);
  const tax = num(rec?.taxWithheld ?? rec?.tax_withheld);
  const net = num(rec?.netPay ?? rec?.net_pay);
  const superAmount = num(rec?.superAmount ?? rec?.super_amount);
  const superRate = num(rec?.superRate ?? rec?.super_rate) || DEFAULT_SUPER_RATE;
  const ordinaryAmount = Math.round(hours * rate * 100) / 100;

  return {
    employeeName: staff?.full_name || 'Staff Member',
    employmentType: staff?.employment_type || 'casual',
    weekLabel: getWeekLabel(weekStart),
    periodStartIso: weekStart,
    periodEndIso: periodEnd.toISOString().split('T')[0],
    periodStartLabel: fmtDate(periodStart),
    periodEndLabel: fmtDate(periodEnd),
    paymentDateLabel: fmtDate(paymentDate),
    hours,
    rate,
    ordinaryAmount,
    travel,
    gross,
    tax,
    net,
    superAmount,
    superRate,
    superFundName: SUPER_FUND_NAME,
    superFundNumber: SUPER_FUND_NUMBER,
    businessName: BUSINESS_NAME,
    businessAbn: BUSINESS_ABN,
    businessEmail: BUSINESS_EMAIL,
  };
}

function buildPayslipFilename(slip) {
  const start = slip.periodStartIso || 'week_start';
  const end = slip.periodEndIso || 'week_end';
  return `Payslip_${start}_to_${end}.pdf`;
}

function createPayslipPdfAttachment(slip) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 56;

  const write = (text, opts = {}) => {
    const { size = 11, weight = 'normal', color = [38, 53, 45], x = 52 } = opts;
    doc.setFont('helvetica', weight);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(String(text), x, y);
  };

  const right = (text, opts = {}) => {
    const { size = 11, weight = 'normal', color = [38, 53, 45], x = pageWidth - 52 } = opts;
    doc.setFont('helvetica', weight);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(String(text), x, y, { align: 'right' });
  };

  const row = (label, value, opts = {}) => {
    write(label, { size: 11, color: [111, 127, 116] });
    right(value, { size: 11, weight: opts.bold ? 'bold' : 'normal', color: opts.highlight ? [53, 82, 64] : [38, 53, 45] });
    y += 20;
  };

  write(slip.businessName, { size: 22, weight: 'bold', color: [53, 82, 64] });
  y += 20;
  write(`Payslip - ${slip.weekLabel}`, { size: 12, color: [111, 127, 116] });
  y += 26;

  doc.setDrawColor(220, 228, 217);
  doc.line(52, y, pageWidth - 52, y);
  y += 22;

  row('Employee', slip.employeeName);
  row('Employment Type', slip.employmentType);
  row('Pay Period', `${slip.periodStartLabel} to ${slip.periodEndLabel}`);
  row('Payment Date', slip.paymentDateLabel);
  if (slip.businessAbn) row('Employer ABN', slip.businessAbn);
  y += 10;

  doc.line(52, y, pageWidth - 52, y);
  y += 22;

  row('Ordinary Hours', `${slip.hours.toFixed(2)} x ${fmtCurrency(slip.rate)}/hr`);
  row('Ordinary Pay', fmtCurrency(slip.ordinaryAmount));
  if (slip.travel > 0) row('Travel Allowance', fmtCurrency(slip.travel));
  row('Gross Pay', fmtCurrency(slip.gross));
  row('PAYG Tax Withheld (ATO)', `-${fmtCurrency(slip.tax)}`);
  row('Net Pay', fmtCurrency(slip.net), { bold: true, highlight: true });
  y += 10;

  doc.line(52, y, pageWidth - 52, y);
  y += 22;

  row(`Super Contribution (${(slip.superRate * 100).toFixed(1)}%)`, fmtCurrency(slip.superAmount));
  row('Super Fund', `${slip.superFundName}${slip.superFundNumber ? ` (${slip.superFundNumber})` : ''}`);

  y = Math.max(y + 18, doc.internal.pageSize.getHeight() - 74);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(111, 127, 116);
  doc.text(
    `Generated by ${slip.businessName}. This payslip includes key Fair Work required details.`,
    52,
    y
  );

  const dataUri = doc.output('datauristring');
  const base64 = dataUri.includes(',')
    ? dataUri.split(',')[1]
    : dataUri;
  return { dataUri, base64 };
}
function buildPayslipPrintHtml(slip) {
  const travelRow = slip.travel > 0 ? `<tr><td>Travel allowance</td><td style="text-align:right;">${fmtCurrency(slip.travel)}</td></tr>` : '';
  const abnLine = slip.businessAbn ? `<tr><td>Employer ABN</td><td style="text-align:right;">${escapeHtml(slip.businessAbn)}</td></tr>` : '';
  const casualNote = slip.employmentType === 'casual'
    ? `<div style="font-size:12px;color:#6F7F74;margin:0 0 10px;">Note: hourly rate includes casual loading where applicable.</div>`
    : '';
  return `<!DOCTYPE html>
<html>
<head>
<title>Payslip — ${escapeHtml(slip.employeeName)}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 700px; margin: 30px auto; color: #26352D; }
  h1 { font-size: 24px; margin: 0 0 4px; color: #355240; }
  .sub { color: #6F7F74; font-size: 14px; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { padding: 10px 12px; border-bottom: 1px solid #DCE4D9; text-align: left; }
  th { background: #E8EFE4; color: #355240; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; }
  .total td { font-weight: 800; font-size: 16px; color: #355240; }
  .meta td { font-size: 13px; }
  .footer { font-size: 11px; color: #6F7F74; margin-top: 10px; border-top: 1px solid #DCE4D9; padding-top: 10px; }
</style>
</head>
<body>
<h1>${escapeHtml(slip.businessName)}</h1>
<div class="sub">Payslip — ${escapeHtml(slip.weekLabel)}</div>
<table class="meta">
  <tr><th colspan="2">Employee Details</th></tr>
  <tr><td>Employee</td><td style="text-align:right;">${escapeHtml(slip.employeeName)}</td></tr>
  <tr><td>Employment type</td><td style="text-align:right;text-transform:capitalize;">${escapeHtml(slip.employmentType)}</td></tr>
  ${abnLine}
  <tr><td>Pay period</td><td style="text-align:right;">${escapeHtml(slip.periodStartLabel)} to ${escapeHtml(slip.periodEndLabel)}</td></tr>
  <tr><td>Payment date</td><td style="text-align:right;">${escapeHtml(slip.paymentDateLabel)}</td></tr>
</table>
<table>
  <tr><th>Description</th><th style="text-align:right;">Amount</th></tr>
  <tr><td>Ordinary hours (${slip.hours.toFixed(2)} × ${fmtCurrency(slip.rate)}/hr)</td><td style="text-align:right;">${fmtCurrency(slip.ordinaryAmount)}</td></tr>
  ${travelRow}
  <tr><td>Gross pay</td><td style="text-align:right;">${fmtCurrency(slip.gross)}</td></tr>
  <tr><td>PAYG tax withheld (ATO)</td><td style="text-align:right;">-${fmtCurrency(slip.tax)}</td></tr>
  <tr class="total"><td>Net pay</td><td style="text-align:right;">${fmtCurrency(slip.net)}</td></tr>
</table>
${casualNote}
<table>
  <tr><th colspan="2">Superannuation</th></tr>
  <tr><td>Contribution (${(slip.superRate * 100).toFixed(1)}%)</td><td style="text-align:right;">${fmtCurrency(slip.superAmount)}</td></tr>
  <tr><td>Fund</td><td style="text-align:right;">${escapeHtml(slip.superFundName)}${slip.superFundNumber ? ` (${escapeHtml(slip.superFundNumber)})` : ''}</td></tr>
</table>
<div class="footer">
  This payslip includes the minimum details required under Fair Work payslip rules. Contact ${escapeHtml(slip.businessName)}${slip.businessEmail ? ` via ${escapeHtml(slip.businessEmail)}` : ''} for payroll queries.
</div>
</body>
</html>`;
}

export default function PayrollTab({ showToast, isMobile }) {
  const [weekStart, setWeekStart] = useState(() => getMonday(TODAY));
  const [overrides, setOverrides] = useState({}); // staffId → { hoursWorked, travelHours, travelAllowance }
  const [processing, setProcessing] = useState(false);
  const [emailingId, setEmailingId] = useState(null);
  const [viewPayslip, setViewPayslip] = useState(null);

  const { staffMembers }                         = useProfiles();
  const { payrollRecords, savePayrollRecord }    = usePayroll();
  const { scheduledJobs }                        = useScheduledJobs();
  const { timeEntries }                          = useStaffTimeEntries({ weekStart });

  // Build draft payroll rows for this week
  const draftRows = useMemo(() => {
    return staffMembers.map(staff => {
      // Check if already processed for this week
      const existing = payrollRecords.find(
        r => r.staff_id === staff.id && r.week_start === weekStart
      );
      if (existing) return { staff, existing, draft: null };

      // Auto-calculate hours from jobs
      const hoursCalc = calcHoursFromJobs(scheduledJobs, staff.id, weekStart, timeEntries);

      const ov = overrides[staff.id] || {};
      const hoursWorked    = ov.hoursWorked    ?? hoursCalc.hoursWorked;
      const travelHours    = ov.travelHours    ?? 0;
      const travelAllowance = ov.travelAllowance ?? 0;

      const breakdown = calcPayrollBreakdown({
        hoursWorked,
        travelHours,
        hourlyRate: staff.hourly_rate || 0,
        travelAllowance,
        superRate: staff.super_rate ?? DEFAULT_SUPER_RATE,
        employmentType: staff.employment_type || 'casual',
      });

      return {
        staff,
        existing: null,
        draft: {
          ...breakdown,
          hoursWorked,
          travelHours,
          travelAllowance,
          weekStart,
          staffId: staff.id,
          jobsCompleted: hoursCalc.completedJobs,
          jobsScheduled: hoursCalc.scheduledJobs,
          hoursSource: hoursCalc.hoursSource,
          scheduledHours: hoursCalc.scheduledHours,
          completedHours: hoursCalc.completedHours,
          employmentType: staff.employment_type || 'casual',
          superRate: staff.super_rate ?? DEFAULT_SUPER_RATE,
          hourlyRate: staff.hourly_rate || 0,
        },
      };
    });
  }, [staffMembers, payrollRecords, scheduledJobs, weekStart, overrides, timeEntries]);

  const hasAnyDraft    = draftRows.some(r => r.draft !== null);
  const hasAnyExisting = draftRows.some(r => r.existing !== null);

  const handleOverride = (staffId, field, value) => {
    setOverrides(prev => ({
      ...prev,
      [staffId]: { ...(prev[staffId] || {}), [field]: parseFloat(value) || 0 },
    }));
  };

  const handleProcess = useCallback(async () => {
    setProcessing(true);
    try {
      for (const row of draftRows) {
        if (!row.draft) continue;
        await savePayrollRecord({
          staff_id:        row.staff.id,
          week_start:      weekStart,
          hours_worked:    row.draft.hoursWorked,
          travel_hours:    row.draft.travelHours,
          hourly_rate:     row.draft.hourlyRate,
          gross_pay:       row.draft.grossPay,
          tax_withheld:    row.draft.taxWithheld,
          super_amount:    row.draft.superAmount,
          super_rate:      row.draft.superRate,
          travel_allowance: row.draft.travelAllowance,
          net_pay:         row.draft.netPay,
          employment_type: row.draft.employmentType,
          status:          'processed',
          processed_at:    new Date().toISOString(),
        });
      }
      setOverrides({});
      showToast('✅ Payroll processed!');
    } catch (e) {
      showToast('❌ Failed to process payroll');
      console.error(e);
    }
    setProcessing(false);
  }, [draftRows, weekStart, savePayrollRecord, showToast]);

  const handlePrintPayslip = (row) => {
    const rec = row.existing || row.draft;
    if (!rec) return;
    setViewPayslip({ staff: row.staff, rec });
  };

  const handleEmailPayslip = useCallback(async (row) => {
    const rec = row.existing || row.draft;
    const recipientEmail = (row?.staff?.email || "").trim();
    const recipientName = (row?.staff?.full_name || "Staff").trim();
    if (!rec || !recipientEmail) { showToast('No email on file for this staff member'); return; }
    if (!EMAILJS_SERVICE_ID || !EMAILJS_PUBLIC_KEY || !EMAILJS_PAYROLL_TEMPLATE_ID) {
      showToast('EmailJS not configured for payroll');
      return;
    }
    const slip = buildPayslipData(row.staff, rec, weekStart);
    const payslipFilename = buildPayslipFilename(slip);
    const payslipAttachment = createPayslipPdfAttachment(slip);
    const portalUrl = import.meta.env.VITE_STAFF_PORTAL_URL || `${window.location.origin}/cleaner`;
    const cleanMessage = `Hi ${recipientName},\n\nPlease find attached your payslip for the week ${slip.periodStartLabel} to ${slip.periodEndLabel}.\n\nIf you have any payroll questions, reply to this email.\n\n${BUSINESS_NAME}`;
    setEmailingId(row.staff.id);
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_PAYROLL_TEMPLATE_ID, {
        to_name:    recipientName,
        to_email:   recipientEmail,
        customer_name: recipientName,
        customer_email: recipientEmail,
        reply_to: BUSINESS_EMAIL || recipientEmail,
        subject: `${BUSINESS_NAME} payslip — ${slip.weekLabel}`,
        headline: `Payslip attached (${slip.weekLabel})`,
        message: cleanMessage.replace(/\n/g, "<br>"),
        payslip_text: cleanMessage,
        week_label: slip.weekLabel,
        pay_period: `${slip.periodStartLabel} to ${slip.periodEndLabel}`,
        payment_date: slip.paymentDateLabel,
        employer_name: BUSINESS_NAME,
        employer_abn: BUSINESS_ABN || '',
        gross_pay:  fmtCurrency(slip.gross),
        tax:        fmtCurrency(slip.tax),
        super_amt:  fmtCurrency(slip.superAmount),
        net_pay:    fmtCurrency(slip.net),
        hours:      slip.hours.toFixed(2),
        hourly_rate: fmtCurrency(slip.rate),
        ordinary_pay: fmtCurrency(slip.ordinaryAmount),
        travel_allowance: fmtCurrency(slip.travel),
        super_rate: `${(slip.superRate * 100).toFixed(1)}%`,
        super_fund_name: slip.superFundName,
        super_fund_number: slip.superFundNumber || '',
        show_button: "true",
        button_text: "Open Staff Portal",
        button_link: portalUrl,
        attachment: payslipAttachment.base64,
        attachment_data_uri: payslipAttachment.dataUri,
        attachment_content_type: "application/pdf",
        attachment_name: payslipFilename,
        payslip_attachment: payslipAttachment.base64,
        payslip_attachment_data_uri: payslipAttachment.dataUri,
        payslip_filename: payslipFilename,
      }, EMAILJS_PUBLIC_KEY);
      showToast(`✅ Payslip emailed to ${recipientName}`);
    } catch (e) {
      const details = e?.text || e?.message || "Unknown email error";
      console.error('[payroll:email] failed', e);
      showToast(`❌ Payslip email failed: ${details}`);
    } finally {
      setEmailingId(null);
    }
  }, [weekStart, showToast]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.text }}>💵 Payroll</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: T.textMuted }}>Weekly payroll run — ATO 2024-25</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setWeekStart(prevMonday(weekStart))} style={navBtn}>← Prev</button>
          <div style={{ padding: '8px 14px', borderRadius: T.radiusSm, background: weekStart === getMonday(TODAY) ? T.primaryLight : '#fff', border: `1.5px solid ${weekStart === getMonday(TODAY) ? T.primary : T.border}`, color: T.text, fontSize: 13, fontWeight: 700, textAlign: 'center', minWidth: 190 }}>
            {getWeekLabel(weekStart)}
          </div>
          <button onClick={() => setWeekStart(nextMonday(weekStart))} style={navBtn}>Next →</button>
          {hasAnyDraft && (
            <button
              onClick={handleProcess}
              disabled={processing}
              style={{ padding: '9px 18px', borderRadius: T.radiusSm, border: 'none', background: T.primary, color: '#fff', fontSize: 13, fontWeight: 800, cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.7 : 1 }}
            >
              {processing ? 'Processing…' : '⚡ Process Payroll'}
            </button>
          )}
        </div>
      </div>

      {staffMembers.length === 0 && (
        <div style={{ background: '#fff', borderRadius: T.radius, padding: 40, textAlign: 'center', boxShadow: T.shadow }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
          <div style={{ fontWeight: 700, color: T.text, marginBottom: 6 }}>No staff members found</div>
          <div style={{ fontSize: 13, color: T.textMuted }}>Add staff accounts in Supabase Auth to run payroll.</div>
        </div>
      )}

      {/* Payroll cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {draftRows.map(({ staff, draft, existing }) => {
          const rec = existing || draft;
          if (!rec) return null;
          const isProcessed = !!existing;
          const ov = overrides[staff.id] || {};

          return (
            <div key={staff.id} style={{ background: '#fff', borderRadius: T.radius, overflow: 'hidden', boxShadow: T.shadowMd, border: `1px solid ${isProcessed ? T.primaryLight : T.border}` }}>
              {/* Card header */}
              <div style={{ padding: '14px 20px', background: isProcessed ? T.primaryLight : T.bg, borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: T.text }}>{staff.full_name}</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>
                    {staff.employment_type || 'casual'} · ${staff.hourly_rate || 0}/hr
                    {isProcessed && <span style={{ color: T.primaryDark, fontWeight: 700, marginLeft: 8 }}>✅ Processed</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: isProcessed ? T.primaryDark : T.text }}>
                    {fmtCurrency(rec.netPay || rec.net_pay)}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>net pay</div>
                </div>
              </div>

              {/* Detail grid */}
              <div style={{ padding: '16px 20px' }}>
                {/* Editable hours (draft only) */}
                {!isProcessed && (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                    <EditField
                      label="Hours Worked"
                      value={ov.hoursWorked ?? rec.hoursWorked ?? 0}
                      onChange={v => handleOverride(staff.id, 'hoursWorked', v)}
                      hint={
                        draft?.hoursSource === 'clock_timesheet'
                          ? `Auto: ${draft?.clockHours || 0}h from staff clock records (${draft?.clockEntries || 0} day${(draft?.clockEntries || 0) === 1 ? '' : 's'})`
                          : draft?.hoursSource === 'published_rota_schedule'
                            ? `Auto: ${draft?.scheduledHours || 0}h from published rota (${draft?.jobsScheduled || 0} jobs)`
                            : `Auto: ${draft?.completedHours || 0}h from completed jobs (${draft?.jobsCompleted || 0}/${draft?.jobsScheduled || 0})`
                      }
                    />
                    <EditField
                      label="Travel Hours"
                      value={ov.travelHours ?? 0}
                      onChange={v => handleOverride(staff.id, 'travelHours', v)}
                    />
                    <EditField
                      label="Travel Allowance ($)"
                      value={ov.travelAllowance ?? 0}
                      onChange={v => handleOverride(staff.id, 'travelAllowance', v)}
                    />
                  </div>
                )}

                {/* Breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
                  <StatBox label="Hours Worked" value={`${rec.hoursWorked || rec.hours_worked || 0}h`} />
                  <StatBox label="Gross Pay"    value={fmtCurrency(rec.grossPay   || rec.gross_pay)} />
                  <StatBox label="PAYG Tax"     value={fmtCurrency(rec.taxWithheld || rec.tax_withheld)} sub={`${fmtPercent((rec.taxWithheld || rec.tax_withheld || 0) / Math.max(rec.grossPay || rec.gross_pay || 1, 1))}`} />
                  <StatBox label="Net Pay"      value={fmtCurrency(rec.netPay || rec.net_pay)} highlight={T.primaryDark} />
                </div>

                {/* Super (shown separately — employer cost, not deducted) */}
                <div style={{ padding: '10px 14px', background: T.blueLight, borderRadius: T.radiusSm, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.blue }}>Superannuation</div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>Employer contribution ({fmtPercent((rec.superRate || rec.super_rate) ?? DEFAULT_SUPER_RATE)}) — not deducted from employee pay</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T.blue }}>{fmtCurrency(rec.superAmount || rec.super_amount)}</div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handlePrintPayslip({ staff, existing, draft })}
                    style={{ padding: '9px 16px', borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: '#fff', color: T.text, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    🖨️ Print Payslip
                  </button>
                  {staff.email && (
                    <button
                      onClick={() => handleEmailPayslip({ staff, existing, draft })}
                      disabled={emailingId === staff.id}
                      style={{ padding: '9px 16px', borderRadius: T.radiusSm, border: 'none', background: T.blue, color: '#fff', fontSize: 13, fontWeight: 700, cursor: emailingId === staff.id ? 'not-allowed' : 'pointer', opacity: emailingId === staff.id ? 0.7 : 1 }}
                    >
                      {emailingId === staff.id ? '…' : '📧 Email Payslip'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ATO disclaimer */}
      <div style={{ marginTop: 20, padding: '12px 16px', background: T.accentLight, borderRadius: T.radiusSm, fontSize: 12, color: '#8B6914' }}>
        ⚠️ <strong>Compliance note:</strong> Payslips now include employer, employee, pay period, payment date, gross/net, deductions and super details. Verify tax/award interpretation with your accountant. Default super is 12% (effective from 1 July 2025).
      </div>

      {/* Payslip print modal */}
      {viewPayslip && (
        <PayslipModal
          staff={viewPayslip.staff}
          rec={viewPayslip.rec}
          weekStart={weekStart}
          onClose={() => setViewPayslip(null)}
        />
      )}
    </div>
  );
}

// ── Editable number field ─────────────────────────────────
function EditField({ label, value, onChange, hint }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: 'block', marginBottom: 4 }}>
        {label}{hint && <span style={{ fontWeight: 400, marginLeft: 4 }}>({hint})</span>}
      </label>
      <input
        type="number"
        min="0"
        step="0.25"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, fontSize: 14, fontWeight: 700, color: T.text, boxSizing: 'border-box', background: '#fff' }}
      />
    </div>
  );
}

// ── Stat display box ──────────────────────────────────────
function StatBox({ label, value, sub, highlight }) {
  return (
    <div style={{ background: T.bg, borderRadius: T.radiusSm, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: highlight || T.text }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.textMuted }}>{sub}</div>}
    </div>
  );
}

// ── Navigation button style ───────────────────────────────
const navBtn = {
  padding: '8px 14px', borderRadius: T.radiusSm,
  border: `1.5px solid ${T.border}`, background: '#fff',
  color: T.text, fontSize: 13, fontWeight: 700, cursor: 'pointer',
};

// ══════════════════════════════════════════════════════════
// PAYSLIP PRINT MODAL
// ══════════════════════════════════════════════════════════
function PayslipModal({ staff, rec, weekStart, onClose }) {
  const slip = buildPayslipData(staff, rec, weekStart);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    win.document.write(buildPayslipPrintHtml(slip));
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: T.radiusLg, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.text }}>🌿 Payslip Preview</div>
            <div style={{ fontSize: 12, color: T.textMuted }}>{slip.employeeName} · {slip.weekLabel}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: T.textMuted }}>✕</button>
        </div>

        <div style={{ background: T.bg, borderRadius: T.radiusSm, padding: '12px 14px', marginBottom: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
          <div><strong>Employer:</strong> {slip.businessName}</div>
          <div><strong>ABN:</strong> {slip.businessAbn || 'Add VITE_BUSINESS_ABN'}</div>
          <div><strong>Pay period:</strong> {slip.periodStartLabel} to {slip.periodEndLabel}</div>
          <div><strong>Payment date:</strong> {slip.paymentDateLabel}</div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 14 }}>
          <tbody>
            <PayslipRow label="Ordinary Hours" value={`${slip.hours.toFixed(2)}h × ${fmtCurrency(slip.rate)}/hr`} />
            <PayslipRow label="Ordinary Pay" value={fmtCurrency(slip.ordinaryAmount)} />
            {slip.travel > 0 && <PayslipRow label="Travel Allowance" value={fmtCurrency(slip.travel)} />}
            <PayslipRow label="Gross Pay" value={fmtCurrency(slip.gross)} bold />
            <PayslipRow label="PAYG Tax Withheld (ATO)" value={`−${fmtCurrency(slip.tax)}`} muted />
            <PayslipRow label="Net Pay" value={fmtCurrency(slip.net)} bold highlight />
          </tbody>
        </table>

        <div style={{ padding: '10px 14px', background: T.blueLight, borderRadius: T.radiusSm, marginBottom: 20, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span style={{ color: T.blue, fontWeight: 700 }}>Super ({(slip.superRate * 100).toFixed(1)}%) · {slip.superFundName}{slip.superFundNumber ? ` (${slip.superFundNumber})` : ''}</span>
          <span style={{ color: T.blue, fontWeight: 800 }}>{fmtCurrency(slip.superAmount)}</span>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handlePrint} style={{ flex: 1, padding: '12px', borderRadius: T.radiusSm, border: 'none', background: T.primary, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            🖨️ Print / Save PDF
          </button>
          <button onClick={onClose} style={{ padding: '12px 16px', borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: '#fff', color: T.textMuted, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function PayslipRow({ label, value, bold, muted, highlight }) {
  return (
    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
      <td style={{ padding: '8px 0', color: muted ? T.textMuted : T.text, fontWeight: bold ? 700 : 400 }}>{label}</td>
      <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: bold ? 800 : 600, fontSize: highlight ? 17 : 14, color: highlight ? T.primaryDark : muted ? T.danger : T.text }}>{value}</td>
    </tr>
  );
}
