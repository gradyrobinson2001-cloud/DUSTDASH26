import React from "react";
import { T, SERVICED_AREAS } from "../shared";

export default function PricingTab({ pricing, setEditPriceModal, setAddServiceModal, removeService, isMobile }) {
  const roomServices = Object.entries(pricing).filter(([_, v]) => v.category === "room");
  const addonServices = Object.entries(pricing).filter(([_, v]) => v.category === "addon");

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Pricing</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>Manage services & prices. Changes update the customer form automatically.</p>
        </div>
        <button onClick={() => setAddServiceModal(true)} style={{ padding: "10px 18px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          + Add Service
        </button>
      </div>

      <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>Room Pricing</h3>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? "140px" : "180px"}, 1fr))`, gap: 12, marginBottom: 28 }}>
        {roomServices.map(([k, v]) => (
          <div key={k} style={{ background: "#fff", borderRadius: T.radius, padding: isMobile ? "16px" : "20px", boxShadow: T.shadow, textAlign: "center", position: "relative" }}>
            <button onClick={() => removeService(k)} style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: T.textLight, fontSize: 14 }}>✕</button>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{v.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 2 }}>{v.label}</div>
            <div style={{ fontSize: 11, color: T.textLight, marginBottom: 10 }}>{v.unit}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: T.primary }}>${v.price}</div>
            <button onClick={() => setEditPriceModal(k)} style={{ marginTop: 12, padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 12, fontWeight: 700, color: T.textMuted, cursor: "pointer" }}>
              Edit
            </button>
          </div>
        ))}
      </div>

      <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>Add-on Pricing</h3>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? "140px" : "180px"}, 1fr))`, gap: 12, marginBottom: 28 }}>
        {addonServices.map(([k, v]) => (
          <div key={k} style={{ background: "#fff", borderRadius: T.radius, padding: isMobile ? "16px" : "20px", boxShadow: T.shadow, textAlign: "center", position: "relative" }}>
            <button onClick={() => removeService(k)} style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: T.textLight, fontSize: 14 }}>✕</button>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{v.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 2 }}>{v.label}</div>
            <div style={{ fontSize: 11, color: T.textLight, marginBottom: 10 }}>{v.unit}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: T.blue }}>${v.price}</div>
            <button onClick={() => setEditPriceModal(k)} style={{ marginTop: 12, padding: "6px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 12, fontWeight: 700, color: T.textMuted, cursor: "pointer" }}>
              Edit
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
        <div style={{ background: T.accentLight, borderRadius: T.radius, padding: "18px 22px" }}>
          <h4 style={{ margin: "0 0 6px", fontWeight: 700, color: "#8B6914" }}>🎉 Weekly Discount</h4>
          <p style={{ margin: 0, fontSize: 13, color: T.text }}>10% automatically applied to all weekly bookings</p>
        </div>
        <div style={{ background: T.primaryLight, borderRadius: T.radius, padding: "18px 22px" }}>
          <h4 style={{ margin: "0 0 6px", fontWeight: 700, color: T.primaryDark }}>📍 Service Areas</h4>
          <p style={{ margin: 0, fontSize: 13, color: T.text }}>{SERVICED_AREAS.join(", ")}</p>
        </div>
      </div>
    </>
  );
}
