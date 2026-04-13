import React from "react";
import { T, calcQuote } from "../shared";
import { ChannelIcon, StatusBadge } from "../components/ui";

export default function QuotesTab({
  quotes,
  pricing,
  isMobile,
  setEditQuoteModal,
  setPreviewQuote,
  approveQuote,
  markAccepted,
}) {
  const pendingQuotes = quotes.filter(q => q.status === "pending_approval");
  const sentQuotes = quotes.filter(q => q.status === "sent" || q.status === "accepted");

  return (
    <>
      <h1 style={{ margin: "0 0 4px", fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Quotes</h1>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: T.textMuted }}>{quotes.length} total quotes</p>

      {/* Pending Approval */}
      {pendingQuotes.length > 0 && (
        <>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: 0.8 }}>⏳ Pending Your Approval</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
            {pendingQuotes.map(q => {
              const calc = calcQuote(q.details, pricing);
              return (
                <div key={q.id} style={{ background: "#fff", borderRadius: T.radiusLg, padding: isMobile ? "18px 16px" : "24px 28px", boxShadow: T.shadowMd, borderTop: `3px solid ${T.accent}` }}>
                  <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", gap: 10, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: 16, color: T.text }}>{q.name}</span>
                      <ChannelIcon ch={q.channel} />
                      <span style={{ fontSize: 12, color: T.textLight }}>📍 {q.suburb}</span>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: T.primary }}>${calc.total.toFixed(2)}</div>
                  </div>

                  {/* Line items */}
                  <div style={{ background: T.bg, borderRadius: T.radiusSm, padding: "14px 16px", marginBottom: 14, fontSize: 13 }}>
                    {calc.items.map((item, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: T.textMuted }}>
                        <span>{item.description} × {item.qty}</span>
                        <span style={{ fontWeight: 700, color: T.text }}>${item.total.toFixed(2)}</span>
                      </div>
                    ))}
                    {calc.discountLabel && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: T.primaryDark, fontWeight: 700, borderTop: `1px solid ${T.border}`, marginTop: 6, paddingTop: 8 }}>
                        <span>{calc.discountLabel}</span>
                        <span>-${calc.discount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 14 }}>
                    📅 {q.frequency} clean · Quote #{q.id}
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={() => setEditQuoteModal(q)} style={{ padding: "10px 16px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, color: T.textMuted }}>
                      ✏️ Edit
                    </button>
                    <button onClick={() => setPreviewQuote(q)} style={{ padding: "10px 16px", borderRadius: T.radiusSm, border: `1.5px solid ${T.primary}`, background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, color: T.primary }}>
                      👁️ Preview
                    </button>
                    <button onClick={() => approveQuote(q.id)} style={{ padding: "10px 18px", borderRadius: T.radiusSm, border: "none", background: `linear-gradient(135deg, ${T.primary}, ${T.blue})`, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", boxShadow: "0 2px 8px rgba(74,158,126,0.3)" }}>
                      ✅ Approve & Send
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Sent / Accepted Quotes */}
      {sentQuotes.length > 0 && (
        <>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>Sent & Accepted</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sentQuotes.map(q => {
              const calc = calcQuote(q.details, pricing);
              return (
                <div key={q.id} style={{ background: "#fff", borderRadius: T.radius, padding: isMobile ? "14px 16px" : "16px 20px", boxShadow: T.shadow, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <ChannelIcon ch={q.channel} size={14} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: T.text, minWidth: isMobile ? "auto" : 130 }}>{q.name}</span>
                  {!isMobile && <span style={{ fontSize: 12, color: T.textLight }}>📍 {q.suburb}</span>}
                  <span style={{ fontSize: 12, color: T.textMuted }}>{q.frequency}</span>
                  <span style={{ fontWeight: 800, fontSize: 15, color: T.primary, marginLeft: "auto" }}>${calc.total.toFixed(2)}</span>
                  <StatusBadge status={q.status} />
                  {q.status === "sent" && (
                    <button onClick={() => markAccepted(q.id)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "#D4EDDA", color: "#155724", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      ✓ Accepted
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {quotes.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: T.textLight }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          <p>No quotes yet — they'll appear when you generate them from the inbox</p>
        </div>
      )}
    </>
  );
}
