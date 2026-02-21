import React from "react";
import { T, DEFAULT_SCHEDULE_SETTINGS } from "../shared";
import { useScheduleSettings } from "../hooks/useScheduleSettings";

export default function FormTab({ showToast, isMobile }) {
  const { scheduleSettings, setScheduleSettings, loading } = useScheduleSettings();
  const formUrl = typeof window !== "undefined" ? window.location.origin + "/form" : "/form";
  const formOptions = {
    ...DEFAULT_SCHEDULE_SETTINGS.formOptions,
    ...(scheduleSettings?.formOptions || {}),
  };

  const updateFormOption = async (key, value) => {
    const next = {
      ...(scheduleSettings || DEFAULT_SCHEDULE_SETTINGS),
      formOptions: {
        ...formOptions,
        [key]: value,
      },
    };
    await setScheduleSettings(next);
    showToast("✅ Quote form setting updated");
  };

  return (
    <>
      <h1 style={{ margin: "0 0 4px", fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Client Quote Form</h1>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: T.textMuted }}>Edit the public quote form and share the link below.</p>

      <div style={{ background: "#fff", borderRadius: T.radiusLg, padding: isMobile ? "20px" : "28px 32px", boxShadow: T.shadowMd, marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800, color: T.text }}>📎 Shareable Form Link</h3>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, padding: "12px 16px", borderRadius: T.radiusSm, background: T.bg, border: `1.5px solid ${T.border}`, fontSize: 14, color: T.primary, fontWeight: 600, wordBreak: "break-all" }}>
            {formUrl}
          </div>
          <button
            onClick={() => { navigator.clipboard?.writeText(formUrl); showToast("📋 Link copied!"); }}
            style={{ padding: "12px 20px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Copy Link
          </button>
          <a
            href="/form"
            target="_blank"
            rel="noopener noreferrer"
            style={{ padding: "12px 20px", borderRadius: T.radiusSm, border: `1.5px solid ${T.primary}`, background: "#fff", color: T.primary, fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Open Form ↗
          </a>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: T.radiusLg, padding: isMobile ? "20px" : "24px 28px", boxShadow: T.shadowMd, marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: T.text }}>Form Display Options</h3>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: T.textMuted }}>
          These settings update the live customer form immediately.
        </p>

        {loading ? (
          <div style={{ fontSize: 13, color: T.textMuted }}>Loading settings...</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <ToggleRow
              label="Show prices on extras"
              description="Display dollar pricing on optional extras (oven, windows, organising, etc.)."
              enabled={Boolean(formOptions.showAddonPrices)}
              onToggle={() => updateFormOption("showAddonPrices", !formOptions.showAddonPrices)}
            />
            <ToggleRow
              label="Show weekly discount badges"
              description="Display the weekly discount highlight in frequency selection."
              enabled={Boolean(formOptions.showWeeklyDiscountBadge)}
              onToggle={() => updateFormOption("showWeeklyDiscountBadge", !formOptions.showWeeklyDiscountBadge)}
            />
            <ToggleRow
              label="Show summary card before submit"
              description="Display the quick summary panel on the final step."
              enabled={Boolean(formOptions.showStepSummary)}
              onToggle={() => updateFormOption("showStepSummary", !formOptions.showStepSummary)}
            />
          </div>
        )}
      </div>

      <div style={{ background: T.blueLight, borderRadius: T.radius, padding: "20px 24px" }}>
        <h4 style={{ margin: "0 0 8px", fontWeight: 700, color: T.blue }}>How it works</h4>
        <div style={{ fontSize: 13, color: T.text, lineHeight: 2 }}>
          1️⃣ Customer clicks the link (from your auto-reply message)<br />
          2️⃣ They select their suburb first to check we service their area<br />
          3️⃣ They fill in their details, room counts, frequency & add-ons<br />
          4️⃣ Submission appears in your Inbox with status "Info Received"<br />
          5️⃣ You click "Generate Quote" → review → approve & send
        </div>
      </div>
    </>
  );
}

function ToggleRow({ label, description, enabled, onToggle }) {
  return (
    <div style={{ border: `1.5px solid ${T.border}`, borderRadius: T.radiusSm, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{label}</div>
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{description}</div>
      </div>
      <button
        onClick={onToggle}
        type="button"
        style={{
          width: 54,
          height: 30,
          border: "none",
          borderRadius: 999,
          cursor: "pointer",
          background: enabled ? T.primary : T.border,
          position: "relative",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: enabled ? 27 : 3,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.14s ease",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </button>
    </div>
  );
}
