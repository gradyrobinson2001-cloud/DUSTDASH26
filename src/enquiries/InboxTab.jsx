import React from "react";
import { T, SERVICED_AREAS, getFollowUpStatus, daysSince } from "../shared";
import { ChannelIcon, StatusBadge, SearchInput, actionBtn, timeAgo } from "../components/ui";

export default function InboxTab({
  enquiries,
  quotes,
  filter,
  setFilter,
  searchTerm,
  setSearchTerm,
  quotesNeedingFollowUp,
  archivedCount,
  isMobile,
  setPage,
  setSelectedEnquiry,
  setSelectedRecipients,
  sendInfoForm,
  generateQuote,
  declineOutOfArea,
  archiveEnquiry,
  unarchiveEnquiry,
  removeEnquiry,
}) {
  const filtered = enquiries.filter(e => {
    if (filter === "archived") return e.archived;
    if (filter !== "all" && e.archived) return false;
    if (filter === "active") return !e.archived;
    if (filter === "new") return e.status === "new";
    if (filter === "awaiting") return e.status === "info_requested";
    if (filter === "received") return e.status === "info_received";
    if (filter === "quote_ready") return e.status === "quote_ready";
    if (filter === "sent") return e.status === "quote_sent";
    if (filter === "accepted") return e.status === "accepted";
    if (filter === "out") return e.status === "out_of_area";
    return true;
  }).filter(e => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return e.name.toLowerCase().includes(term) || e.suburb.toLowerCase().includes(term) || e.message.toLowerCase().includes(term);
  });

  return (
    <>
      {/* Follow-up Alert Banner */}
      {quotesNeedingFollowUp.length > 0 && (
        <div style={{ background: T.accentLight, borderRadius: T.radius, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#8B6914" }}>
                {quotesNeedingFollowUp.length} quote{quotesNeedingFollowUp.length > 1 ? "s" : ""} awaiting response
              </div>
              <div style={{ fontSize: 12, color: T.textMuted }}>
                Oldest: {Math.max(...quotesNeedingFollowUp.map(e => daysSince(e.quoteSentAt || e.timestamp)))} days ago
              </div>
            </div>
          </div>
          <button onClick={() => setPage("emails")} style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: "none", background: "#8B6914", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            📧 Send Follow-ups
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Inbox</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>{enquiries.filter(e => !e.archived).length} active · {archivedCount} archived</p>
        </div>
        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search enquiries..." />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { id: "active", label: "Active" }, { id: "new", label: "New" }, { id: "awaiting", label: "Awaiting" },
          { id: "received", label: "Received" }, { id: "quote_ready", label: "Quote Ready" },
          { id: "sent", label: "Sent" }, { id: "accepted", label: "Accepted" }, { id: "archived", label: `Archived (${archivedCount})` },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: "6px 12px", borderRadius: 20, border: filter === f.id ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`,
            background: filter === f.id ? T.primaryLight : "#fff", color: filter === f.id ? T.primaryDark : T.textMuted,
            fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Enquiry Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map(e => {
          const followUp = e.status === "quote_sent" ? getFollowUpStatus(e.quoteSentAt || e.timestamp) : null;
          return (
            <div key={e.id} style={{
              background: "#fff", borderRadius: T.radius, padding: isMobile ? "14px 16px" : "18px 20px",
              boxShadow: T.shadow,
              borderLeft: e.archived ? `4px solid ${T.textLight}` : followUp?.level === "urgent" ? `4px solid ${T.danger}` : followUp?.level === "warning" ? `4px solid ${T.accent}` : e.status === "new" ? `4px solid ${T.blue}` : e.status === "info_received" ? `4px solid ${T.accent}` : "4px solid transparent",
              opacity: e.archived ? 0.7 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: isMobile ? 10 : 14 }}>
                <div style={{ width: isMobile ? 36 : 42, height: isMobile ? 36 : 42, borderRadius: 12, background: `linear-gradient(135deg, ${T.primary}, ${T.blue})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: isMobile ? 12 : 14, flexShrink: 0 }}>
                  {e.avatar}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: isMobile ? 14 : 15, color: T.text }}>{e.name}</span>
                    <ChannelIcon ch={e.channel} size={isMobile ? 12 : 14} />
                    <span style={{ fontSize: 11, color: T.textLight }}>📍 {e.suburb}</span>
                    <span style={{ fontSize: 11, color: T.textLight, marginLeft: "auto" }}>{timeAgo(e.timestamp)}</span>
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: 13, color: T.textMuted, lineHeight: 1.5 }}>{e.message}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <StatusBadge status={e.status} />
                    {followUp && (
                      <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: followUp.level === "urgent" ? T.dangerLight : T.accentLight, color: followUp.color }}>
                        {followUp.label}
                      </span>
                    )}
                    {e.details?.email && (
                      <span style={{ fontSize: 11, color: T.textMuted, display: isMobile ? "none" : "inline" }}>📧 {e.details.email}</span>
                    )}
                    {!e.archived && (
                      <>
                        {e.status === "new" && !SERVICED_AREAS.includes(e.suburb) && (
                          <button onClick={() => declineOutOfArea(e.id)} style={actionBtn("#FDF0EF", T.danger)}>📍 Out of Area</button>
                        )}
                        {e.status === "new" && SERVICED_AREAS.includes(e.suburb) && (
                          <button onClick={() => sendInfoForm(e.id)} style={actionBtn(T.blueLight, T.blue)}>📤 Send Form</button>
                        )}
                        {e.status === "info_received" && !e.quoteId && (
                          <button onClick={() => generateQuote(e.id)} style={actionBtn(T.primaryLight, T.primaryDark)}>💰 Quote</button>
                        )}
                        {e.status === "quote_ready" && (
                          <button onClick={() => setPage("quotes")} style={actionBtn(T.primaryLight, T.primaryDark)}>👁️ Review</button>
                        )}
                        {followUp && followUp.days >= 3 && (
                          <button onClick={() => { setPage("emails"); setSelectedRecipients([e.id]); }} style={actionBtn(T.accentLight, "#8B6914")}>📩 Follow-up</button>
                        )}
                        {e.details && (
                          <button onClick={() => setSelectedEnquiry(e)} style={actionBtn(T.borderLight, T.textMuted)}>📋 Details</button>
                        )}
                        <button onClick={() => archiveEnquiry(e.id)} style={actionBtn(T.borderLight, T.textMuted)}>📦</button>
                      </>
                    )}
                    {e.archived && (
                      <>
                        <button onClick={() => unarchiveEnquiry(e.id)} style={actionBtn(T.primaryLight, T.primaryDark)}>📤 Restore</button>
                        <button onClick={() => removeEnquiry(e.id)} style={actionBtn("#FDF0EF", T.danger)}>🗑️</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, color: T.textLight }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <p style={{ fontSize: 15 }}>{searchTerm ? "No results found" : "No enquiries match this filter"}</p>
          </div>
        )}
      </div>
    </>
  );
}
