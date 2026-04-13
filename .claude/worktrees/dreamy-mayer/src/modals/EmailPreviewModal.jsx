import React from "react";
import { T, calcQuote } from "../shared";
import { Modal } from "../components/ui";

export default function EmailPreviewModal({ quote, enquiry, pricing, onSend, onClose, sending }) {
  const calc = calcQuote(quote.details, pricing);
  const customerEmail = enquiry?.details?.email || "No email found";
  const customerName = quote.name.split(" ")[0];

  return (
    <Modal title="📧 Preview Email" onClose={onClose} wide>
      <div style={{ background: T.blueLight, borderRadius: T.radiusSm, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 13, color: T.textMuted }}>Sending to:</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.blue }}>{customerEmail}</span>
      </div>

      <div style={{ border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ background: T.sidebar, padding: "24px", textAlign: "center", color: "#fff" }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>🌿</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Dust Bunnies Cleaning</div>
          <div style={{ fontSize: 12, color: "#8FBFA8", marginTop: 4 }}>Eco-conscious cleaning · Sunshine Coast</div>
        </div>
        <div style={{ background: T.primary, padding: "10px 24px", textAlign: "center" }}>
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>YOUR CLEANING QUOTE</span>
        </div>
        <div style={{ padding: "24px" }}>
          <p style={{ margin: "0 0 16px", fontSize: 16, color: T.text }}>Hey <strong>{customerName}</strong>! 👋</p>
          <p style={{ margin: "0 0 20px", fontSize: 14, color: T.textMuted, lineHeight: 1.7 }}>
            Thanks so much for getting in touch! We've put together a personalised quote for your <strong style={{ color: T.text }}>{quote.frequency}</strong> clean in <strong style={{ color: T.text }}>{quote.suburb}</strong>.
          </p>
          <div style={{ background: T.bg, borderRadius: T.radiusSm, padding: "20px", marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Quote Summary</div>
            {calc.items.map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14, color: T.text }}>
                <span>{item.description} × {item.qty}</span>
                <span style={{ fontWeight: 600 }}>${item.total.toFixed(2)}</span>
              </div>
            ))}
            {calc.discountLabel && (
              <>
                <hr style={{ border: "none", borderTop: `1px solid ${T.border}`, margin: "12px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: T.primaryDark, fontWeight: 700 }}>
                  <span>🎉 Weekly Discount (10%)</span>
                  <span>-${calc.discount.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
          <div style={{ background: `linear-gradient(135deg, ${T.primary}, ${T.blue})`, borderRadius: T.radiusSm, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.9 }}>TOTAL PER CLEAN</div>
              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>per {quote.frequency.toLowerCase()} visit</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>${calc.total.toFixed(2)}</div>
          </div>
          <div style={{ background: T.primaryLight, borderRadius: T.radiusSm, padding: "16px 20px", borderLeft: `4px solid ${T.primary}` }}>
            <p style={{ margin: "0 0 4px", fontWeight: 700, color: T.primaryDark }}>Ready to get started? 💚</p>
            <p style={{ margin: 0, fontSize: 13, color: T.text }}>Simply reply to this email and we'll get your first clean booked in!</p>
          </div>
        </div>
        <div style={{ background: T.bg, padding: "16px 24px", textAlign: "center", borderTop: `1px solid ${T.border}` }}>
          <p style={{ margin: 0, fontSize: 12, color: T.textMuted }}>Chat soon! 💚</p>
          <p style={{ margin: "6px 0 0", fontSize: 11, color: T.textLight }}>Dust Bunnies Cleaning · Sunshine Coast, QLD</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={onClose} disabled={sending} style={{ flex: 1, padding: "14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", fontWeight: 700, fontSize: 14, cursor: sending ? "not-allowed" : "pointer", color: T.textMuted }}>
          Cancel
        </button>
        <button onClick={onSend} disabled={sending || !enquiry?.details?.email} style={{
          flex: 2, padding: "14px", borderRadius: T.radiusSm, border: "none",
          background: (!enquiry?.details?.email || sending) ? T.border : `linear-gradient(135deg, ${T.primary}, ${T.blue})`,
          fontWeight: 700, fontSize: 14, cursor: (!enquiry?.details?.email || sending) ? "not-allowed" : "pointer", color: "#fff",
          boxShadow: enquiry?.details?.email && !sending ? "0 4px 12px rgba(74,158,126,0.3)" : "none",
        }}>
          {sending ? "Sending..." : `📧 Send to ${customerEmail}`}
        </button>
      </div>

      {!enquiry?.details?.email && (
        <div style={{ marginTop: 12, padding: "12px 16px", background: "#FDF0EF", borderRadius: T.radiusSm, fontSize: 13, color: T.danger }}>
          ⚠️ No email address found for this customer. Please check the enquiry details.
        </div>
      )}
    </Modal>
  );
}
