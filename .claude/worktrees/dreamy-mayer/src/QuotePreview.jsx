import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { T, calcQuote, loadPricing } from "./shared";

// ═══════════════════════════════════════════════════════════
// QUOTE PREVIEW — Full-page printable/shareable quote
// ═══════════════════════════════════════════════════════════

export default function QuotePreview() {
  const [searchParams] = useSearchParams();

  const { quote, calc } = useMemo(() => {
    try {
      const raw = searchParams.get("data");
      const q = raw ? JSON.parse(decodeURIComponent(raw)) : null;
      if (!q) return { quote: null, calc: null };
      const p = q.pricing || loadPricing();
      return { quote: q, calc: calcQuote(q.details, p) };
    } catch { return { quote: null, calc: null }; }
  }, [searchParams]);

  if (!quote) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, textAlign: "center" }}>
        <div>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
          <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800, color: T.text }}>Quote Not Found</h1>
          <p style={{ fontSize: 14, color: T.textMuted }}>This quote link may have expired. Please contact us for a new quote.</p>
        </div>
      </div>
    );
  }

  const today = new Date();
  const validUntil = new Date(today);
  validUntil.setDate(validUntil.getDate() + 14);
  const fmt = (d) => d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <div style={{ minHeight: "100vh", background: T.bg, padding: "32px 20px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", background: "#fff", borderRadius: T.radiusLg, overflow: "hidden", boxShadow: T.shadowLg }}>

          {/* Header */}
          <div style={{ background: T.sidebar, padding: "32px 40px", color: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 900 }}>🌿 Dust Bunnies Cleaning</div>
                <div style={{ fontSize: 13, color: "#8FBFA8", marginTop: 4 }}>Eco-conscious cleaning · Sunshine Coast, QLD</div>
              </div>
              <div style={{ width: 50, height: 50, borderRadius: 14, background: T.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800 }}>DB</div>
            </div>
          </div>

          {/* Quote banner */}
          <div style={{ background: T.primary, padding: "10px 40px", color: "#fff", display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
            <span>CLEANING QUOTE</span>
            <span>#{quote.id}</span>
          </div>

          <div style={{ padding: "32px 40px" }}>
            {/* Meta row */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Prepared For</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: T.text, marginTop: 4 }}>{quote.name}</div>
                <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>{quote.suburb}, Sunshine Coast</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Quote Date</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginTop: 4 }}>{fmt(today)}</div>
                <div style={{ fontSize: 10, color: T.textLight, marginTop: 4 }}>Valid until {fmt(validUntil)}</div>
              </div>
            </div>

            {/* Frequency */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 28, padding: "8px 16px", borderRadius: 8, background: T.primaryLight }}>
              <span style={{ fontSize: 13, color: T.textMuted }}>Frequency:</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: T.primaryDark }}>{quote.frequency}</span>
              {quote.details?.frequency === "weekly" && (
                <span style={{ background: T.accent, color: T.sidebar, padding: "2px 10px", borderRadius: 10, fontSize: 10, fontWeight: 800 }}>SAVE 10%</span>
              )}
            </div>

            {/* Items Table */}
            <div style={{ borderRadius: T.radius, overflow: "hidden", marginBottom: 24, border: `1px solid ${T.border}` }}>
              <div style={{ background: T.sidebar, padding: "12px 20px", display: "flex", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
                <span style={{ flex: 1 }}>SERVICE</span>
                <span style={{ width: 60, textAlign: "center" }}>QTY</span>
                <span style={{ width: 80, textAlign: "center" }}>UNIT PRICE</span>
                <span style={{ width: 80, textAlign: "right" }}>TOTAL</span>
              </div>
              {calc.items.map((item, i) => (
                <div key={i} style={{ padding: "14px 20px", display: "flex", fontSize: 14, background: i % 2 ? T.bg : "#fff", alignItems: "center" }}>
                  <span style={{ flex: 1, color: T.text, fontWeight: 600 }}>{item.description}</span>
                  <span style={{ width: 60, textAlign: "center", color: T.textMuted }}>{item.qty}</span>
                  <span style={{ width: 80, textAlign: "center", color: T.textMuted }}>${item.unitPrice.toFixed(2)}</span>
                  <span style={{ width: 80, textAlign: "right", fontWeight: 800, color: T.text }}>${item.total.toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
              <div style={{ width: 260 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 14, color: T.textMuted, borderBottom: `1px solid ${T.borderLight}` }}>
                  <span>Subtotal</span><span style={{ fontWeight: 700, color: T.text }}>${calc.subtotal.toFixed(2)}</span>
                </div>
                {calc.discountLabel && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 14, color: T.primaryDark, fontWeight: 700, borderBottom: `1px solid ${T.borderLight}` }}>
                    <span>{calc.discountLabel}</span><span>-${calc.discount.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Total Box */}
            <div style={{ background: `linear-gradient(135deg, ${T.primary}, ${T.blue})`, borderRadius: T.radius, padding: "20px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>TOTAL PER CLEAN</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>per {quote.frequency?.toLowerCase()} visit</div>
              </div>
              <div style={{ fontSize: 36, fontWeight: 900 }}>${calc.total.toFixed(2)}</div>
            </div>

            {/* CTA */}
            <div style={{ marginTop: 28, background: T.primaryLight, borderRadius: T.radius, padding: "20px 24px", borderLeft: `4px solid ${T.primary}` }}>
              <h4 style={{ margin: "0 0 6px", fontWeight: 800, color: T.primaryDark }}>Ready to get started? 💚</h4>
              <p style={{ margin: 0, fontSize: 14, color: T.text, lineHeight: 1.7 }}>
                Simply reply to this message or email and we'll get your first clean booked in. If you have any questions at all, we're always happy to chat!
              </p>
            </div>

            {/* What's Included */}
            <div style={{ marginTop: 24, background: T.bg, borderRadius: T.radius, padding: "20px 24px" }}>
              <h4 style={{ margin: "0 0 10px", fontWeight: 800, color: T.text, fontSize: 14 }}>What's included in every clean:</h4>
              <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 2.2 }}>
                ✅ All cleaning products & equipment provided<br />
                ✅ Eco-friendly, sustainable products only<br />
                ✅ Fully insured & police checked<br />
                ✅ Consistent cleaner each visit<br />
                ✅ Easy reschedule or cancel anytime
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: `1px solid ${T.border}`, padding: "16px 40px", textAlign: "center", background: T.bg }}>
            <p style={{ margin: 0, fontSize: 11, color: T.textLight }}>
              Dust Bunnies Cleaning · Sunshine Coast, QLD · dustbunzcleaning@gmail.com
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 10, color: T.textLight }}>
              Eco-conscious · Sustainable products · Local Sunshine Coast business 🌿
            </p>
          </div>
        </div>

        {/* Print button */}
        <div style={{ maxWidth: 700, margin: "20px auto 0", display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={() => window.print()} style={{
            padding: "12px 28px", borderRadius: T.radius, border: "none", background: T.primary, color: "#fff",
            fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: T.shadow,
          }}>
            🖨️ Print / Save as PDF
          </button>
          <a href="/" style={{
            padding: "12px 28px", borderRadius: T.radius, border: `1.5px solid ${T.border}`, background: "#fff",
            fontWeight: 700, fontSize: 14, cursor: "pointer", color: T.textMuted, textDecoration: "none",
            display: "inline-flex", alignItems: "center",
          }}>
            ← Back to Dashboard
          </a>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: #fff !important; }
          button, a { display: none !important; }
        }
      `}</style>
    </>
  );
}