import React from "react";
import { T, addInvoice, loadInvoices } from "../shared";

export default function PaymentsTab({
  scheduledJobs,
  setScheduledJobs,
  scheduleClients,
  invoices,
  setInvoices,
  paymentFilter,
  setPaymentFilter,
  setShowInvoiceModal,
  showToast,
  isMobile,
}) {
  const completedJobs = scheduledJobs.filter(j => j.status === "completed");
  const unpaidJobs = completedJobs.filter(j => j.paymentStatus !== "paid");
  const paidJobs = completedJobs.filter(j => j.paymentStatus === "paid");
  const totalEarned = paidJobs.reduce((sum, j) => sum + (j.price || 0), 0);
  const totalOwed = unpaidJobs.reduce((sum, j) => sum + (j.price || 0), 0);
  const thisMonthEarned = paidJobs.filter(j => {
    const jobDate = new Date(j.date);
    const now = new Date();
    return jobDate.getMonth() === now.getMonth() && jobDate.getFullYear() === now.getFullYear();
  }).reduce((sum, j) => sum + (j.price || 0), 0);

  const filteredJobs = paymentFilter === "unpaid"
    ? completedJobs.filter(j => j.paymentStatus !== "paid")
    : paymentFilter === "paid"
    ? completedJobs.filter(j => j.paymentStatus === "paid")
    : completedJobs;

  return (
    <>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Payments</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>Track payments & generate invoices</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: T.radius, padding: "20px", boxShadow: T.shadow }}>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>Total Earned</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: T.primary }}>${totalEarned.toFixed(0)}</div>
          <div style={{ fontSize: 11, color: T.textLight }}>{paidJobs.length} paid jobs</div>
        </div>
        <div style={{ background: "#fff", borderRadius: T.radius, padding: "20px", boxShadow: T.shadow }}>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>Outstanding</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: totalOwed > 0 ? T.danger : T.text }}>${totalOwed.toFixed(0)}</div>
          <div style={{ fontSize: 11, color: T.textLight }}>{unpaidJobs.length} unpaid jobs</div>
        </div>
        <div style={{ background: "#fff", borderRadius: T.radius, padding: "20px", boxShadow: T.shadow }}>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>Invoices Sent</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: T.blue }}>{invoices.length}</div>
          <div style={{ fontSize: 11, color: T.textLight }}>{invoices.filter(i => i.status === "paid").length} paid</div>
        </div>
        <div style={{ background: "#fff", borderRadius: T.radius, padding: "20px", boxShadow: T.shadow }}>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>This Month</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: T.text }}>${thisMonthEarned.toFixed(0)}</div>
          <div style={{ fontSize: 11, color: T.textLight }}>collected</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[{ id: "unpaid", label: "Unpaid" }, { id: "paid", label: "Paid" }, { id: "all", label: "All Jobs" }, { id: "invoices", label: "Invoices" }].map(f => (
          <button key={f.id} onClick={() => setPaymentFilter(f.id)} style={{
            padding: "8px 16px", borderRadius: 20,
            border: paymentFilter === f.id ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`,
            background: paymentFilter === f.id ? T.primaryLight : "#fff",
            color: paymentFilter === f.id ? T.primaryDark : T.textMuted,
            fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Invoices List */}
      {paymentFilter === "invoices" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {invoices.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: T.radius, padding: 40, textAlign: "center", color: T.textLight }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🧾</div>
              <p>No invoices yet</p>
            </div>
          ) : (
            invoices.map(inv => (
              <div key={inv.id} style={{ background: "#fff", borderRadius: T.radius, padding: "16px 20px", boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: T.radiusSm, background: inv.status === "paid" ? T.primaryLight : T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🧾</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{inv.invoiceNumber}</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>{inv.clientName} · {new Date(inv.createdAt).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: T.text }}>${inv.amount?.toFixed(2)}</div>
                  <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: inv.status === "paid" ? T.primaryLight : T.accentLight, color: inv.status === "paid" ? T.primaryDark : "#8B6914" }}>
                    {inv.status === "paid" ? "Paid" : "Unpaid"}
                  </span>
                </div>
                {inv.status !== "paid" && (
                  <button
                    onClick={() => {
                      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: "paid", paidAt: new Date().toISOString() } : i));
                      showToast("✅ Invoice marked as paid");
                    }}
                    style={{ padding: "8px 12px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                  >
                    Mark Paid
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        /* Jobs List */
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredJobs.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: T.radius, padding: 40, textAlign: "center", color: T.textLight }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
              <p>No {paymentFilter} jobs</p>
            </div>
          ) : (
            filteredJobs.sort((a, b) => b.date.localeCompare(a.date)).map(job => {
              const client = scheduleClients.find(c => c.id === job.clientId);
              const isPaid = job.paymentStatus === "paid";
              return (
                <div key={job.id} style={{ background: "#fff", borderRadius: T.radius, padding: "16px 20px", boxShadow: T.shadow, borderLeft: `4px solid ${isPaid ? T.primary : T.accent}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{job.clientName}</span>
                        <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 700, background: isPaid ? T.primaryLight : T.accentLight, color: isPaid ? T.primaryDark : "#8B6914" }}>
                          {isPaid ? "Paid" : "Unpaid"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: T.textMuted }}>
                        📅 {new Date(job.date).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" })}
                        <span style={{ margin: "0 8px" }}>·</span>
                        📍 {job.suburb}
                        <span style={{ margin: "0 8px" }}>·</span>
                        ⏱️ {job.duration} mins
                      </div>
                      {client?.email && <div style={{ fontSize: 11, color: T.textLight, marginTop: 4 }}>📧 {client.email}</div>}
                    </div>
                    <div style={{ textAlign: "right", marginRight: 16 }}>
                      <div style={{ fontWeight: 700, fontSize: 20, color: T.text }}>${job.price?.toFixed(2) || "—"}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {!isPaid && (
                        <>
                          <button
                            onClick={() => {
                              setScheduledJobs(prev => prev.map(j => j.id === job.id ? { ...j, paymentStatus: "paid", paidAt: new Date().toISOString() } : j));
                              showToast("✅ Marked as paid");
                            }}
                            style={{ padding: "8px 12px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                          >
                            💳 Mark Paid
                          </button>
                          <button
                            onClick={() => setShowInvoiceModal(job)}
                            style={{ padding: "8px 12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textMuted, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                          >
                            🧾 Invoice
                          </button>
                        </>
                      )}
                      {isPaid && (
                        <button
                          onClick={() => {
                            setScheduledJobs(prev => prev.map(j => j.id === job.id ? { ...j, paymentStatus: "unpaid", paidAt: null } : j));
                            showToast("Marked as unpaid");
                          }}
                          style={{ padding: "8px 12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textMuted, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
