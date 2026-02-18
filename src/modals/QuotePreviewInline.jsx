import React from "react";
import { T, calcQuote } from "../shared";

export default function QuotePreviewInline({ quote, pricing }) {
  const calc = calcQuote(quote.details, pricing);

  return (
    <div style={{ borderRadius: T.radius, overflow: "hidden", border: `1px solid ${T.border}` }}>
      <div style={{ background: T.sidebar, padding: "20px 24px", color: "#fff" }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>🌿 Dust Bunnies Cleaning</div>
        <div style={{ fontSize: 12, color: "#8FBFA8", marginTop: 2 }}>Eco-conscious cleaning | Sunshine Coast</div>
      </div>
      <div style={{ background: T.primary, padding: "8px 24px", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
        <span>CLEANING QUOTE</span><span>#{quote.id}</span>
      </div>

      <div style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Prepared For</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{quote.name}</div>
            <div style={{ fontSize: 12, color: T.textMuted }}>{quote.suburb}, Sunshine Coast</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase" }}>Frequency</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.primaryDark }}>
              {quote.frequency} {quote.details.frequency === "weekly" && <span style={{ background: T.accentLight, padding: "2px 8px", borderRadius: 8, fontSize: 10, color: "#8B6914" }}>SAVE 10%</span>}
            </div>
          </div>
        </div>

        <div style={{ borderRadius: T.radiusSm, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ background: T.sidebar, padding: "8px 14px", display: "flex", color: "#fff", fontSize: 11, fontWeight: 700 }}>
            <span style={{ flex: 1 }}>SERVICE</span><span style={{ width: 50, textAlign: "center" }}>QTY</span><span style={{ width: 60, textAlign: "center" }}>UNIT</span><span style={{ width: 70, textAlign: "right" }}>TOTAL</span>
          </div>
          {calc.items.map((item, i) => (
            <div key={i} style={{ padding: "10px 14px", display: "flex", fontSize: 13, background: i % 2 ? T.bg : "#fff", alignItems: "center" }}>
              <span style={{ flex: 1, color: T.text }}>{item.description}</span>
              <span style={{ width: 50, textAlign: "center", color: T.textMuted }}>{item.qty}</span>
              <span style={{ width: 60, textAlign: "center", color: T.textMuted }}>${item.unitPrice}</span>
              <span style={{ width: 70, textAlign: "right", fontWeight: 700, color: T.text }}>${item.total.toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "right", marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: T.textMuted }}>Subtotal: <span style={{ fontWeight: 700, color: T.text }}>${calc.subtotal.toFixed(2)}</span></div>
          {calc.discountLabel && (
            <div style={{ fontSize: 13, color: T.primaryDark, fontWeight: 700, marginTop: 4 }}>{calc.discountLabel}: -${calc.discount.toFixed(2)}</div>
          )}
        </div>

        <div style={{ background: T.primary, borderRadius: T.radiusSm, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff" }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>TOTAL PER CLEAN</span>
          <span style={{ fontSize: 26, fontWeight: 900 }}>${calc.total.toFixed(2)}</span>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 24px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 11, color: T.textLight }}>Dust Bunnies Cleaning · Sunshine Coast · Eco-conscious 🌿</p>
      </div>
    </div>
  );
}
