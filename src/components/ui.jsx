import React, { useEffect } from "react";
import { T } from "../shared";

// ─── Channel Icon ───
export const ChannelIcon = ({ ch, size = 16 }) => {
  const colors = { messenger: "#0084FF", instagram: "#E1306C", email: "#5B9EC4" };
  const labels = { messenger: "M", instagram: "IG", email: "@" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size + 8, height: size + 8, borderRadius: 6, background: colors[ch] || "#999", color: "#fff", fontSize: size * 0.55, fontWeight: 800 }}>
      {labels[ch] || "?"}
    </span>
  );
};

// ─── Status Badge ───
export const StatusBadge = ({ status }) => {
  const map = {
    new: { bg: "#E6F0F7", color: "#3B82A0", label: "New" },
    info_requested: { bg: "#FFF8E7", color: "#8B6914", label: "Info Requested" },
    info_received: { bg: "#E8F5EE", color: "#2D7A5E", label: "Info Received" },
    quote_ready: { bg: "#E8F5EE", color: "#2D7A5E", label: "Quote Ready" },
    quote_sent: { bg: T.primaryLight, color: T.primaryDark, label: "Quote Sent" },
    accepted: { bg: "#D4EDDA", color: "#155724", label: "Accepted ✓" },
    declined: { bg: "#FDF0EF", color: "#D4645C", label: "Declined" },
    out_of_area: { bg: "#FDF0EF", color: "#D4645C", label: "Out of Area" },
    pending_approval: { bg: "#FFF8E7", color: "#8B6914", label: "Pending Approval" },
    sent: { bg: T.primaryLight, color: T.primaryDark, label: "Sent" },
  };
  const s = map[status] || { bg: "#eee", color: "#666", label: status };
  return (
    <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
};

// ─── Toast ───
export function Toast({ message, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: T.sidebar, color: "#fff", padding: "14px 24px", borderRadius: T.radius, boxShadow: T.shadowLg, fontSize: 14, fontWeight: 600, zIndex: 9999, animation: "slideUp 0.3s ease", maxWidth: "90vw", textAlign: "center" }}>
      {message}
    </div>
  );
}

// ─── Modal ───
export function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(27,58,45,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: T.radiusLg, padding: "24px", maxWidth: wide ? 700 : 500, width: "100%", maxHeight: "85vh", overflow: "auto", boxShadow: T.shadowLg }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: T.textMuted, padding: 4 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Search Input ───
export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div style={{ position: "relative", flex: 1, maxWidth: 300 }}>
      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: T.textLight }}>🔍</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", padding: "10px 12px 10px 38px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, fontSize: 14, color: T.text, outline: "none", boxSizing: "border-box" }}
      />
      {value && (
        <button onClick={() => onChange("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: 14 }}>✕</button>
      )}
    </div>
  );
}

// ─── Action Button Style Helper ───
export function actionBtn(bg, color) {
  return {
    padding: "5px 10px", borderRadius: 8, border: "none", background: bg,
    color, fontSize: 11, fontWeight: 700, cursor: "pointer",
  };
}

// ─── Counter Button Styles ───
export const counterBtn = { width: 32, height: 32, borderRadius: 8, border: "1.5px solid #E2EBE6", background: "#fff", cursor: "pointer", fontSize: 16, fontWeight: 600, color: "#7A8F85", display: "flex", alignItems: "center", justifyContent: "center" };
export const counterBtnPlus = { ...counterBtn, border: "1.5px solid #4A9E7E", background: "#E8F5EE", color: "#4A9E7E" };

// ─── Time Ago Helper ───
export function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
