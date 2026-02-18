import React from "react";
import { T } from "../shared";
import { SearchInput } from "../components/ui";

export default function ClientsTab({ clients, clientSearch, setClientSearch, isMobile }) {
  const filteredClients = clients.filter(c => {
    if (!clientSearch) return true;
    const term = clientSearch.toLowerCase();
    return c.name.toLowerCase().includes(term) || c.email?.toLowerCase().includes(term) || c.phone?.includes(term) || c.suburb?.toLowerCase().includes(term);
  });

  return (
    <>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Clients</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>{clients.length} contacts</p>
        </div>
        <SearchInput value={clientSearch} onChange={setClientSearch} placeholder="Search name, email, phone..." />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filteredClients.map(c => (
          <div key={c.id} style={{ background: "#fff", borderRadius: T.radius, padding: isMobile ? "14px 16px" : "18px 20px", boxShadow: T.shadow }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: c.status === "client" ? `linear-gradient(135deg, ${T.primary}, ${T.blue})` : T.border, display: "flex", alignItems: "center", justifyContent: "center", color: c.status === "client" ? "#fff" : T.textMuted, fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                {c.name?.split(" ").map(n => n[0]).join("") || "?"}
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>{c.name}</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>📍 {c.suburb}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
                {c.email && <a href={`mailto:${c.email}`} style={{ color: T.blue, textDecoration: "none" }}>📧 {c.email}</a>}
                {c.phone && <a href={`tel:${c.phone}`} style={{ color: T.primary, textDecoration: "none" }}>📱 {c.phone}</a>}
              </div>
              <span style={{
                padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: c.status === "client" ? "#D4EDDA" : T.accentLight,
                color: c.status === "client" ? "#155724" : "#8B6914",
              }}>
                {c.status === "client" ? "Client ✓" : "Lead"}
              </span>
            </div>
          </div>
        ))}
        {filteredClients.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, color: T.textLight }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <p>{clientSearch ? "No results found" : "No clients yet — they'll appear when customers submit the form"}</p>
          </div>
        )}
      </div>
    </>
  );
}
