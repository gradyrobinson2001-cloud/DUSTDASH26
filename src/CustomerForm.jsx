import { useState, useEffect } from "react";
import { T, SERVICED_AREAS, loadPricing } from "./shared";

// ═══════════════════════════════════════════════════════════
// CUSTOMER INFO FORM — Suburb-First Flow, Mobile-Ready
// ═══════════════════════════════════════════════════════════

export default function CustomerForm() {
  const [step, setStep] = useState(0); // Start at step 0 for suburb check
  const [submitted, setSubmitted] = useState(false);
  const [pricing, setPricing] = useState({});
  const [isMobile, setIsMobile] = useState(window.innerWidth < 520);
  
  const [fd, setFd] = useState({
    name: "", email: "", phone: "", suburb: "",
    frequency: "fortnightly",
    notes: ""
  });
  
  const u = (k, v) => setFd({ ...fd, [k]: v });

  // Load dynamic pricing from localStorage
  useEffect(() => {
    setPricing(loadPricing());
  }, []);

  // Initialize room counts based on loaded pricing
  useEffect(() => {
    if (Object.keys(pricing).length > 0) {
      const roomServices = Object.entries(pricing).filter(([_, v]) => v.category === "room");
      const addonServices = Object.entries(pricing).filter(([_, v]) => v.category === "addon");
      
      const initialState = { ...fd };
      roomServices.forEach(([key]) => {
        if (initialState[key] === undefined) initialState[key] = 1;
      });
      addonServices.forEach(([key, service]) => {
        if (initialState[key] === undefined) initialState[key] = false;
        if (service.hasQuantity && initialState[`${key}Count`] === undefined) {
          initialState[`${key}Count`] = 0;
        }
      });
      setFd(initialState);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricing]);

  // Responsive listener
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 520);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const isOutOfArea = fd.suburb === "__other";
  const isInArea = fd.suburb && fd.suburb !== "__other";
  const canProceed1 = fd.name && fd.email && fd.phone;
  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const roomServices = Object.entries(pricing).filter(([_, v]) => v.category === "room");
  const addonServices = Object.entries(pricing).filter(([_, v]) => v.category === "addon");

  const handleSubmit = () => {
    // Store in localStorage so the dashboard picks it up
    const submission = { 
      ...fd, 
      submittedAt: new Date().toISOString() 
    };
    localStorage.setItem("db_form_submission", JSON.stringify(submission));
    setSubmitted(true);
  };

  const RoomCounter = ({ k, label, icon }) => (
    <div style={{ background: "#fff", borderRadius: T.radiusSm, padding: isMobile ? "14px 16px" : "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${T.borderLight}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: isMobile ? 18 : 22 }}>{icon}</span>
        <span style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, color: T.text }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => u(k, Math.max(0, (fd[k] || 0) - 1))} style={minusBtn}>−</button>
        <span style={{ width: 28, textAlign: "center", fontWeight: 800, fontSize: 18, color: T.text }}>{fd[k] || 0}</span>
        <button onClick={() => u(k, (fd[k] || 0) + 1)} style={plusBtn}>+</button>
      </div>
    </div>
  );

  const AddonToggle = ({ k, label, icon, subtitle, service }) => (
    <div style={{
      borderRadius: T.radiusSm, overflow: "hidden",
      border: fd[k] ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`,
      background: fd[k] ? T.primaryLight : "#fff", transition: "all 0.15s",
    }}>
      <button onClick={() => u(k, !fd[k])} style={{
        display: "flex", alignItems: "center", gap: 12, padding: isMobile ? "14px 16px" : "16px 18px", width: "100%",
        background: "none", border: "none", cursor: "pointer", textAlign: "left",
      }}>
        <span style={{ fontSize: isMobile ? 18 : 22 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{label}</div>
          {subtitle && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>{subtitle}</div>}
        </div>
        <div style={{
          width: 24, height: 24, borderRadius: 7,
          border: fd[k] ? `2px solid ${T.primary}` : `1.5px solid ${T.border}`,
          background: fd[k] ? T.primary : "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {fd[k] && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
        </div>
      </button>
      {fd[k] && service.hasQuantity && (
        <div style={{ padding: "0 18px 16px", display: "flex", alignItems: "center", gap: 12, marginLeft: 36 }}>
          <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 600 }}>How many?</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => u(`${k}Count`, Math.max(1, (fd[`${k}Count`] || 1) - 1))} style={{ ...minusBtn, width: 30, height: 30 }}>−</button>
            <span style={{ width: 28, textAlign: "center", fontWeight: 800, fontSize: 16, color: T.text }}>{fd[`${k}Count`] || 1}</span>
            <button onClick={() => u(`${k}Count`, (fd[`${k}Count`] || 1) + 1)} style={{ ...plusBtn, width: 30, height: 30 }}>+</button>
          </div>
        </div>
      )}
    </div>
  );

  // ─── Out of Area Screen ───
  if (isOutOfArea && step === 0) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
          <div style={{ background: "#fff", borderRadius: T.radiusLg, padding: isMobile ? "32px 24px" : "48px 40px", boxShadow: T.shadowLg }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <span style={{ fontSize: 36 }}>📍</span>
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: isMobile ? 20 : 24, fontWeight: 800, color: T.text }}>We're not there yet!</h2>
            <p style={{ margin: "0 0 24px", fontSize: 15, color: T.textMuted, lineHeight: 1.7 }}>
              Unfortunately we don't currently service your area, but we're expanding soon! Keep an eye on our socials for updates. 🌿
            </p>
            <div style={{ background: T.primaryLight, borderRadius: T.radius, padding: "18px 24px", marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.primaryDark, marginBottom: 6 }}>We currently service:</div>
              <div style={{ fontSize: 13, color: T.text, lineHeight: 1.8 }}>
                {SERVICED_AREAS.join(" · ")}
              </div>
            </div>
            <button onClick={() => { u("suburb", ""); }} style={{ padding: "12px 28px", borderRadius: T.radius, border: `1.5px solid ${T.primary}`, background: "#fff", color: T.primary, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              ← Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Success Screen ───
  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
          <div style={{ background: "#fff", borderRadius: T.radiusLg, padding: isMobile ? "32px 24px" : "48px 40px", boxShadow: T.shadowLg }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: T.primaryLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: isMobile ? 20 : 24, fontWeight: 800, color: T.text }}>You're all set! 🌿</h2>
            <p style={{ margin: "0 0 24px", fontSize: 15, color: T.textMuted, lineHeight: 1.7 }}>
              Thanks so much, {fd.name.split(" ")[0] || "lovely"}! We've got your details and we'll have a personalised quote over to you really soon.
            </p>
            <div style={{ background: T.primaryLight, borderRadius: T.radius, padding: "18px 24px", textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.primaryDark, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Your Details</div>
              <div style={{ fontSize: 13, color: T.text, lineHeight: 2 }}>
                📍 {fd.suburb}<br/>
                {roomServices.map(([key, service]) => (
                  <span key={key}>{service.icon} {fd[key]} {service.label.toLowerCase()}{fd[key] !== 1 ? "s" : ""} · </span>
                ))}
                <br/>
                📅 {fd.frequency.charAt(0).toUpperCase() + fd.frequency.slice(1)} clean
                {fd.frequency === "weekly" && <span style={{ color: T.primary, fontWeight: 700 }}> (with discount!)</span>}
                {addonServices.some(([key]) => fd[key]) && (
                  <>
                    <br/>✨ {addonServices.filter(([key]) => fd[key]).map(([key, service]) => {
                      const qty = service.hasQuantity ? fd[`${key}Count`] : null;
                      return `${service.label}${qty ? ` (${qty})` : ""}`;
                    }).join(", ")}
                  </>
                )}
              </div>
            </div>
            <p style={{ margin: "24px 0 0", fontSize: 13, color: T.textLight }}>Keep an eye on your inbox — we'll be in touch! 💚</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 16px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 24, marginTop: 16 }}>
        <div style={{ fontSize: 36, marginBottom: 6 }}>🌿</div>
        <h1 style={{ margin: "0 0 4px", fontSize: isMobile ? 20 : 24, fontWeight: 900, color: T.text, letterSpacing: -0.3 }}>Dust Bunnies Cleaning</h1>
        <p style={{ margin: 0, fontSize: 14, color: T.textMuted }}>Eco-conscious cleaning on the Sunshine Coast</p>
      </div>

      {/* Progress (only show after suburb step) */}
      {step > 0 && (
        <div style={{ maxWidth: 520, width: "100%", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            {["Your Details", "Your Home", "Frequency", "Extras"].map((s, i) => (
              <span key={i} style={{ fontSize: 10, fontWeight: 700, color: step > i ? T.primary : T.textLight, textTransform: "uppercase", letterSpacing: 0.5 }}>{isMobile && i > 0 ? (i + 1) : s}</span>
            ))}
          </div>
          <div style={{ height: 6, background: T.borderLight, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${T.primary}, ${T.blue})`, borderRadius: 3, transition: "width 0.4s ease" }} />
          </div>
        </div>
      )}

      {/* Form Card */}
      <div style={{ maxWidth: 520, width: "100%", background: "#fff", borderRadius: T.radiusLg, boxShadow: T.shadowLg, overflow: "hidden" }}>

        {/* Step 0: Suburb Check (First!) */}
        {step === 0 && (
          <div style={{ padding: isMobile ? "28px 20px 24px" : "32px 32px 28px" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: isMobile ? 18 : 20, fontWeight: 800, color: T.text }}>First up — where are you? 📍</h2>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: T.textMuted }}>Let's check we service your area before you fill in the rest</p>

            <div>
              <label style={labelStyle}>SELECT YOUR SUBURB</label>
              <select value={fd.suburb} onChange={e => u("suburb", e.target.value)}
                style={{ ...inputStyle, cursor: "pointer", appearance: "none", backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237A8F85' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", backgroundSize: "20px" }}>
                <option value="">Choose your suburb...</option>
                {SERVICED_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                <option value="__other">My suburb isn't listed</option>
              </select>
            </div>

            {isInArea && (
              <div style={{ marginTop: 20, background: T.primaryLight, borderRadius: T.radiusSm, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 24 }}>✅</span>
                <div>
                  <div style={{ fontWeight: 700, color: T.primaryDark, fontSize: 14 }}>Great news!</div>
                  <div style={{ fontSize: 13, color: T.text }}>We service {fd.suburb}. Let's get your quote ready!</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Contact Details */}
        {step === 1 && (
          <div style={{ padding: isMobile ? "28px 20px 24px" : "32px 32px 28px" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: isMobile ? 18 : 20, fontWeight: 800, color: T.text }}>Your details 👋</h2>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: T.textMuted }}>So we know who to send your quote to</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Your Name" value={fd.name} onChange={v => u("name", v)} placeholder="e.g. Sarah Mitchell" />
              <Field label="Email Address" value={fd.email} onChange={v => u("email", v)} placeholder="e.g. sarah@email.com" type="email" />
              <Field label="Phone Number" value={fd.phone} onChange={v => u("phone", v)} placeholder="e.g. 0412 345 678" type="tel" />
            </div>

            <div style={{ marginTop: 20, background: T.blueLight, borderRadius: T.radiusSm, padding: "12px 16px" }}>
              <p style={{ margin: 0, fontSize: 12, color: T.blue }}>📍 Getting quote for: <strong>{fd.suburb}</strong></p>
            </div>
          </div>
        )}

        {/* Step 2: Room Counts */}
        {step === 2 && (
          <div style={{ padding: isMobile ? "28px 20px 24px" : "32px 32px 28px" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: isMobile ? 18 : 20, fontWeight: 800, color: T.text }}>Tell us about your home 🏠</h2>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: T.textMuted }}>This helps us put together an accurate quote</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {roomServices.map(([key, service]) => (
                <RoomCounter key={key} k={key} label={service.label} icon={service.icon} />
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Frequency */}
        {step === 3 && (
          <div style={{ padding: isMobile ? "28px 20px 24px" : "32px 32px 28px" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: isMobile ? 18 : 20, fontWeight: 800, color: T.text }}>How often? 📅</h2>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: T.textMuted }}>Choose what works best for you</p>

            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10 }}>
              {[
                { id: "weekly", label: "Weekly", sub: null },
                { id: "fortnightly", label: "Fortnightly", sub: "Most popular" },
                { id: "monthly", label: "Monthly", sub: null },
              ].map(f => (
                <button key={f.id} onClick={() => u("frequency", f.id)} style={{
                  flex: 1, padding: "18px 14px", borderRadius: T.radius, cursor: "pointer", textAlign: "center",
                  border: fd.frequency === f.id ? `2.5px solid ${T.primary}` : `1.5px solid ${T.border}`,
                  background: fd.frequency === f.id ? T.primaryLight : "#fff",
                }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: fd.frequency === f.id ? T.primaryDark : T.text }}>{f.label}</div>
                  {f.id === "weekly" && (
                    <div style={{ marginTop: 8, background: T.accent, color: T.sidebar, padding: "4px 12px", borderRadius: 12, fontSize: 11, fontWeight: 800, display: "inline-block" }}>🎉 SAVE 10%</div>
                  )}
                  {f.sub && <div style={{ marginTop: 8, fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{f.sub}</div>}
                </button>
              ))}
            </div>
            
            {fd.frequency === "weekly" && (
              <div style={{ marginTop: 16, background: T.accentLight, borderRadius: T.radiusSm, padding: "12px 16px", textAlign: "center" }}>
                <span style={{ fontSize: 13, color: "#8B6914", fontWeight: 700 }}>✨ Great choice! You'll save 10% on every clean.</span>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Extras & Submit */}
        {step === 4 && (
          <div style={{ padding: isMobile ? "28px 20px 24px" : "32px 32px 28px" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: isMobile ? 18 : 20, fontWeight: 800, color: T.text }}>Anything extra? ✨</h2>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: T.textMuted }}>Totally optional — just tick what you'd like</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {addonServices.map(([key, service]) => (
                <AddonToggle
                  key={key}
                  k={key}
                  label={service.label}
                  icon={service.icon}
                  subtitle={service.unit}
                  service={service}
                />
              ))}
            </div>

            <div>
              <label style={labelStyle}>Anything else we should know?</label>
              <textarea value={fd.notes} onChange={e => u("notes", e.target.value)} rows={3} placeholder="e.g. We have 2 dogs, please close the front gate..."
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, height: "auto" }} />
            </div>

            {/* Summary */}
            <div style={{ marginTop: 24, background: T.bg, borderRadius: T.radius, padding: "18px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.primaryDark, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Quick Summary</div>
              <div style={{ fontSize: 13, color: T.text, lineHeight: 2 }}>
                <strong>{fd.name}</strong> · {fd.suburb}<br/>
                {roomServices.map(([key, service]) => (
                  <span key={key}>{service.icon} {fd[key]} · </span>
                ))}
                <br/>
                📅 {fd.frequency.charAt(0).toUpperCase() + fd.frequency.slice(1)}
                {fd.frequency === "weekly" && <span style={{ color: T.primary, fontWeight: 700 }}> (10% off!)</span>}
                {addonServices.some(([key]) => fd[key]) && (
                  <>
                    <br/>✨ {addonServices.filter(([key]) => fd[key]).map(([key, service]) => {
                      const qty = service.hasQuantity ? fd[`${key}Count`] : null;
                      return `${service.label}${qty ? ` (${qty})` : ""}`;
                    }).join(" · ")}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Nav Buttons */}
        <div style={{ padding: isMobile ? "0 20px 24px" : "0 32px 28px", display: "flex", gap: 10, justifyContent: "space-between" }}>
          {step > 0 ? (
            <button onClick={() => setStep(step - 1)} style={{ padding: "13px 20px", borderRadius: T.radius, border: `1.5px solid ${T.border}`, background: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", color: T.textMuted }}>
              ← Back
            </button>
          ) : <div />}

          {step === 0 && (
            <button onClick={() => isInArea && setStep(1)} disabled={!isInArea}
              style={{
                padding: "13px 28px", borderRadius: T.radius, border: "none", fontSize: 14, fontWeight: 700,
                cursor: isInArea ? "pointer" : "not-allowed",
                background: isInArea ? T.primary : T.border,
                color: isInArea ? "#fff" : T.textLight,
              }}>
              Continue →
            </button>
          )}

          {step === 1 && (
            <button onClick={() => canProceed1 && setStep(2)} disabled={!canProceed1}
              style={{
                padding: "13px 28px", borderRadius: T.radius, border: "none", fontSize: 14, fontWeight: 700,
                cursor: canProceed1 ? "pointer" : "not-allowed",
                background: canProceed1 ? T.primary : T.border,
                color: canProceed1 ? "#fff" : T.textLight,
              }}>
              Next →
            </button>
          )}

          {step === 2 && (
            <button onClick={() => setStep(3)} style={{
              padding: "13px 28px", borderRadius: T.radius, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer",
              background: T.primary, color: "#fff",
            }}>
              Next →
            </button>
          )}

          {step === 3 && (
            <button onClick={() => setStep(4)} style={{
              padding: "13px 28px", borderRadius: T.radius, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer",
              background: T.primary, color: "#fff",
            }}>
              Next →
            </button>
          )}

          {step === 4 && (
            <button onClick={handleSubmit} style={{
              padding: "13px 28px", borderRadius: T.radius, border: "none", fontSize: 14, fontWeight: 800, cursor: "pointer",
              background: `linear-gradient(135deg, ${T.primary}, ${T.blue})`, color: "#fff",
              boxShadow: `0 4px 16px rgba(74,158,126,0.3)`,
            }}>
              Submit & Get My Quote 🌿
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: T.textLight }}>🌿 Eco-conscious · ♻️ Sustainable products · 💚 Sunshine Coast local</p>
      </div>
    </div>
  );
}

// ─── Reusable bits ───
const labelStyle = { fontSize: 11, fontWeight: 700, color: "#7A8F85", textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 6 };
const inputStyle = { width: "100%", padding: "12px 16px", borderRadius: 8, border: "1.5px solid #E2EBE6", fontSize: 15, color: "#2C3E36", boxSizing: "border-box", outline: "none" };
const minusBtn = { width: 34, height: 34, borderRadius: 10, border: "1.5px solid #E2EBE6", background: "#fff", cursor: "pointer", fontSize: 18, fontWeight: 600, color: "#7A8F85", display: "flex", alignItems: "center", justifyContent: "center" };
const plusBtn = { ...minusBtn, border: "1.5px solid #4A9E7E", background: "#E8F5EE", color: "#4A9E7E" };

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}
