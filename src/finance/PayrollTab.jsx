import React, { useState, useMemo, useCallback } from 'react';
import emailjs from '@emailjs/browser';
import { T } from '../shared';
import { useProfiles }      from '../hooks/useProfiles';
import { usePayroll }       from '../hooks/usePayroll';
import { useScheduledJobs } from '../hooks/useScheduledJobs';
import { calcPayrollBreakdown, calcHoursFromJobs, fmtCurrency, fmtPercent, getWeekLabel } from '../utils/payroll';

// ═══════════════════════════════════════════════════════════
// PAYROLL TAB — Phase 5
// Weekly payroll run: calculate → review → process → payslips
// ATO NAT 1008 Scale 1 tax (2024-25)
// Super at 11.5% on top of gross
// ═══════════════════════════════════════════════════════════

const TODAY = new Date().toISOString().split('T')[0];
const EMAILJS_SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_PAYROLL_TEMPLATE_ID =
  import.meta.env.VITE_EMAILJS_PAYROLL_TEMPLATE_ID ||
  import.meta.env.VITE_EMAILJS_UNIVERSAL_TEMPLATE_ID ||
  EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

function getMonday(dateStr) {
  const d = new Date(dateStr);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().split('T')[0];
}
function prevMonday(m) { const d = new Date(m); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; }
function nextMonday(m) { const d = new Date(m); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0]; }

export default function PayrollTab({ showToast, isMobile }) {
  const [weekStart, setWeekStart] = useState(() => getMonday(TODAY));
  const [overrides, setOverrides] = useState({}); // staffId → { hoursWorked, travelHours, travelAllowance }
  const [processing, setProcessing] = useState(false);
  const [emailingId, setEmailingId] = useState(null);
  const [viewPayslip, setViewPayslip] = useState(null);

  const { staffMembers }                         = useProfiles();
  const { payrollRecords, savePayrollRecord }    = usePayroll();
  const { scheduledJobs }                        = useScheduledJobs();

  // Build draft payroll rows for this week
  const draftRows = useMemo(() => {
    return staffMembers.map(staff => {
      // Check if already processed for this week
      const existing = payrollRecords.find(
        r => r.staff_id === staff.id && r.week_start === weekStart
      );
      if (existing) return { staff, existing, draft: null };

      // Auto-calculate hours from jobs
      const hoursCalc = calcHoursFromJobs(scheduledJobs, staff.id, weekStart);

      const ov = overrides[staff.id] || {};
      const hoursWorked    = ov.hoursWorked    ?? hoursCalc.hoursWorked;
      const travelHours    = ov.travelHours    ?? 0;
      const travelAllowance = ov.travelAllowance ?? 0;

      const breakdown = calcPayrollBreakdown({
        hoursWorked,
        travelHours,
        hourlyRate: staff.hourly_rate || 0,
        travelAllowance,
        superRate: staff.super_rate ?? 0.115,
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
          superRate: staff.super_rate ?? 0.115,
          hourlyRate: staff.hourly_rate || 0,
        },
      };
    });
  }, [staffMembers, payrollRecords, scheduledJobs, weekStart, overrides]);

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
    setEmailingId(row.staff.id);
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_PAYROLL_TEMPLATE_ID, {
        to_name:    recipientName,
        to_email:   recipientEmail,
        customer_name: recipientName,
        customer_email: recipientEmail,
        reply_to: recipientEmail,
        week_label: getWeekLabel(weekStart),
        gross_pay:  fmtCurrency(rec.grossPay || rec.gross_pay),
        tax:        fmtCurrency(rec.taxWithheld || rec.tax_withheld),
        super_amt:  fmtCurrency(rec.superAmount || rec.super_amount),
        net_pay:    fmtCurrency(rec.netPay || rec.net_pay),
        hours:      (rec.hoursWorked || rec.hours_worked || 0).toString(),
      }, EMAILJS_PUBLIC_KEY);
      showToast(`✅ Payslip emailed to ${recipientName}`);
    } catch (e) {
      const details = e?.text || e?.message || "Unknown email error";
      console.error('[payroll:email] failed', e);
      showToast(`❌ Payslip email failed: ${details}`);
    }
    setEmailingId(null);
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
                        draft?.hoursSource === 'published_rota_schedule'
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
                    <div style={{ fontSize: 11, color: T.textMuted }}>Employer contribution ({fmtPercent((rec.superRate || rec.super_rate) ?? 0.115)}) — not deducted from employee pay</div>
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
        ⚠️ <strong>Tax disclaimer:</strong> Calculations use ATO NAT 1008 Scale 1 (2024-25). Verify with your accountant before processing payments. Super rate is 11.5% (compulsory from 1 July 2024) — check ATO for future years.
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
  const gross   = rec.grossPay    || rec.gross_pay    || 0;
  const tax     = rec.taxWithheld || rec.tax_withheld || 0;
  const net     = rec.netPay      || rec.net_pay      || 0;
  const superA  = rec.superAmount || rec.super_amount || 0;
  const hours   = rec.hoursWorked || rec.hours_worked || 0;
  const rate    = rec.hourlyRate  || rec.hourly_rate  || 0;
  const superR  = rec.superRate   || rec.super_rate   || 0.115;
  const travel  = rec.travelAllowance || rec.travel_allowance || 0;

  const handlePrint = () => {
    const win = window.open('', '_blank');
    win.document.write(`
<!DOCTYPE html>
<html>
<head>
<title>Payslip — ${staff.full_name}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; color: #2C3E36; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .sub { color: #7A8F85; font-size: 14px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th, td { padding: 10px 12px; border-bottom: 1px solid #E2EBE6; text-align: left; }
  th { background: #F4F8F6; font-size: 11px; color: #7A8F85; text-transform: uppercase; }
  .total td { font-weight: 800; font-size: 16px; border-top: 2px solid #4A9E7E; color: #2D7A5E; }
  .super-row td { color: #5B9EC4; font-size: 13px; }
  .footer { font-size: 11px; color: #A3B5AD; margin-top: 24px; border-top: 1px solid #E2EBE6; padding-top: 12px; }
</style>
</head>
<body>
<h1>🌿 Dust Bunnies</h1>
<div class="sub">Payslip — Week of ${getWeekLabel(weekStart)}</div>

<table>
  <tr><th>Employee</th><th>Employment</th><th>Rate</th></tr>
  <tr><td>${staff.full_name}</td><td>${staff.employment_type || 'casual'}</td><td>$${rate}/hr</td></tr>
</table>

<table>
  <tr><th>Description</th><th style="text-align:right">Amount</th></tr>
  <tr><td>Ordinary hours (${hours}h × $${rate})</td><td style="text-align:right">${fmtCurrency(hours * rate)}</td></tr>
  ${travel > 0 ? `<tr><td>Travel allowance</td><td style="text-align:right">${fmtCurrency(travel)}</td></tr>` : ''}
  <tr><td>Gross Pay</td><td style="text-align:right">${fmtCurrency(gross)}</td></tr>
  <tr><td>PAYG Tax Withheld</td><td style="text-align:right">−${fmtCurrency(tax)}</td></tr>
  <tr class="total"><td>Net Pay</td><td style="text-align:right">${fmtCurrency(net)}</td></tr>
</table>

<table>
  <tr><th colspan="2">Superannuation (employer contribution — not from your pay)</th></tr>
  <tr class="super-row"><td>SGC ${(superR * 100).toFixed(1)}% of gross</td><td style="text-align:right">${fmtCurrency(superA)}</td></tr>
</table>

<div class="footer">
  This is a computer-generated payslip. ABN: ___. For queries contact your employer.<br>
  Processed: ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
</div>
</body>
</html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: T.radiusLg, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.text }}>🌿 Payslip Preview</div>
            <div style={{ fontSize: 12, color: T.textMuted }}>{staff.full_name} · {getWeekLabel(weekStart)}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: T.textMuted }}>✕</button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 14 }}>
          <tbody>
            <PayslipRow label="Ordinary Hours" value={`${hours}h × $${rate}/hr`} />
            {travel > 0 && <PayslipRow label="Travel Allowance" value={fmtCurrency(travel)} />}
            <PayslipRow label="Gross Pay" value={fmtCurrency(gross)} bold />
            <PayslipRow label="PAYG Tax Withheld" value={`−${fmtCurrency(tax)}`} muted />
            <PayslipRow label="Net Pay" value={fmtCurrency(net)} bold highlight />
          </tbody>
        </table>

        <div style={{ padding: '10px 14px', background: T.blueLight, borderRadius: T.radiusSm, marginBottom: 20, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span style={{ color: T.blue, fontWeight: 700 }}>Super ({(superR * 100).toFixed(1)}%)</span>
          <span style={{ color: T.blue, fontWeight: 800 }}>{fmtCurrency(superA)}</span>
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
