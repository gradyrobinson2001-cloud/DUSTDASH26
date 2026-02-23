import React, { useMemo, useState } from "react";
import emailjs from "@emailjs/browser";
import { supabase, supabaseReady } from "../lib/supabase";
import { T } from "../shared";
import { useMarketingTemplates } from "../hooks/useMarketingTemplates";

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const EMAILJS_MARKETING_TEMPLATE_ID =
  import.meta.env.VITE_EMAILJS_MARKETING_TEMPLATE_ID ||
  import.meta.env.VITE_EMAILJS_UNIVERSAL_TEMPLATE_ID ||
  import.meta.env.VITE_EMAILJS_TEMPLATE_ID;

const TABS = {
  social: "social",
  email: "email",
};

const SOCIAL_PLATFORMS = [
  { id: "instagram", label: "Instagram Post" },
  { id: "facebook", label: "Facebook Feed" },
];

const STYLE_PRESETS = [
  {
    id: "local_slots",
    label: "Suburb Slot Poster",
    description: "Closest match to your current suburb/day-time post style.",
  },
  {
    id: "promo_offer",
    label: "Promo Poster",
    description: "Offer-led poster with stronger CTA and urgency.",
  },
  {
    id: "general",
    label: "General Social",
    description: "Flexible creative for mixed campaign goals.",
  },
];

const MAX_REFERENCES = 3;
const MAX_EMAILJS_INLINE_IMAGE_BYTES = 180_000;

const SOCIAL_SUGGESTIONS = [
  "Buderim Thursday 12pm fortnightly slot available. Create a suburb slot poster.",
  "Mountain Creek Tuesdays 2pm fortnightly. Create a polished local slot poster.",
  "Maroochydore Friday 12:30pm or 2pm fortnightly slot available. Create an Instagram poster.",
];

const EMAIL_SUGGESTIONS = [
  "We are running a flash promo on oven cleans for $50 this week. Build an email campaign.",
  "Create a reactivation campaign for clients who have not booked in the last 8 weeks.",
  "Create a limited-time campaign for Friday availability in Mudjimba.",
];

const isLikelyEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed reading image file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed loading image preview."));
    image.src = dataUrl;
  });
}

async function optimizeReferenceImage(file) {
  const original = await readFileAsDataUrl(file);
  const image = await loadImage(original);
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return original;

  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function fileNameFromHeadline(headline, suffix = "poster") {
  const base = String(headline || "campaign")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 52) || "campaign";
  return `${base}-${suffix}.png`;
}

function estimateDataUrlBytes(dataUrl) {
  const payload = String(dataUrl || "").split(",")[1] || "";
  return Math.ceil((payload.length * 3) / 4);
}

function initialResult() {
  return {
    prompt: "",
    channel: "social",
    platform: "instagram",
    headline: "",
    subheadline: "",
    cta: "",
    caption: "",
    hashtags: [],
    emailSubject: "",
    emailBody: "",
    imageDataUrl: "",
    imageSize: "",
  };
}

function buildSmartPrompt({ prompt, stylePreset, channel }) {
  const userPrompt = String(prompt || "").trim();
  if (!userPrompt) return "";
  if (channel === "email") return userPrompt;

  if (stylePreset === "local_slots") {
    return [
      userPrompt,
      "",
      "Output goal:",
      "- Create a local suburb slot poster.",
      "- Keep copy minimal and premium.",
      "- Prioritize suburb name and day/time/frequency line.",
    ].join("\n");
  }

  if (stylePreset === "promo_offer") {
    return [
      userPrompt,
      "",
      "Output goal:",
      "- Create a clear offer-led poster with urgency.",
      "- Keep one strong CTA.",
    ].join("\n");
  }

  return userPrompt;
}

function suggestTemplateName({ campaignName, headline, prompt }) {
  const explicit = String(campaignName || "").trim();
  if (explicit) return explicit.slice(0, 56);
  const byHeadline = String(headline || "").trim();
  if (byHeadline) return byHeadline.slice(0, 56);
  const byPrompt = String(prompt || "").trim();
  if (byPrompt) return byPrompt.slice(0, 56);
  return `Campaign ${new Date().toLocaleDateString("en-AU")}`;
}

function TemplateList({ templates, loading, usingLocal, loadTemplate, removeTemplate }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={labelStyle}>Saved Templates</div>
        <div style={{ fontSize: 10, color: T.textLight }}>{usingLocal ? "Local mode" : "Cloud sync"}</div>
      </div>

      <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, maxHeight: 280, overflow: "auto" }}>
        {loading && <div style={{ padding: 10, fontSize: 12, color: T.textMuted }}>Loading...</div>}
        {!loading && templates.length === 0 && (
          <div style={{ padding: 10, fontSize: 12, color: T.textLight }}>No templates saved.</div>
        )}
        {!loading && templates.map((row) => (
          <div key={row.id} style={{ padding: "8px 10px", borderBottom: `1px solid ${T.borderLight}` }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.text }}>{row.name}</div>
            <div style={{ fontSize: 11, color: T.textLight, margin: "3px 0 6px" }}>
              {new Date(row.updated_at).toLocaleDateString("en-AU")}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => loadTemplate(row)} style={smallActionBtn}>Load</button>
              <button onClick={() => removeTemplate(row.id)} style={{ ...smallActionBtn, color: T.danger }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AIMarketingStudioTab({
  clients,
  enquiries,
  addEmailHistory,
  showToast,
  isMobile,
}) {
  const { templates, loading, usingLocal, upsertTemplate, removeTemplate } = useMarketingTemplates();

  const [activeTab, setActiveTab] = useState(TABS.social);
  const [socialPlatform, setSocialPlatform] = useState("instagram");
  const [stylePreset, setStylePreset] = useState("local_slots");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [references, setReferences] = useState([]);
  const [result, setResult] = useState(initialResult);
  const [emailDraft, setEmailDraft] = useState({ subject: "", body: "" });
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  const recipientOptions = useMemo(() => {
    const byEmail = new Map();

    (clients || []).forEach((client) => {
      const email = String(client?.email || "").trim().toLowerCase();
      if (!isLikelyEmail(email)) return;
      if (!byEmail.has(email)) {
        byEmail.set(email, {
          id: `client:${client.id}`,
          name: client.name || "Client",
          email,
          source: "Client",
        });
      }
    });

    (enquiries || []).forEach((enquiry) => {
      const email = String(enquiry?.details?.email || enquiry?.email || "").trim().toLowerCase();
      if (!isLikelyEmail(email)) return;
      if (!byEmail.has(email)) {
        byEmail.set(email, {
          id: `enquiry:${enquiry.id}`,
          name: enquiry?.name || "Lead",
          email,
          source: "Lead",
        });
      }
    });

    return Array.from(byEmail.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 500);
  }, [clients, enquiries]);

  const suggestions = activeTab === TABS.email ? EMAIL_SUGGESTIONS : SOCIAL_SUGGESTIONS;
  const activeStyleMeta = STYLE_PRESETS.find((row) => row.id === stylePreset) || STYLE_PRESETS[0];

  const studioColumns = isMobile
    ? "1fr"
    : activeTab === TABS.email
      ? "340px 1fr 320px"
      : "340px 1fr 320px";

  const getAccessToken = async () => {
    if (!supabaseReady || !supabase) throw new Error("Supabase auth is not configured.");
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message || "Failed to load auth session.");
    const token = data?.session?.access_token;
    if (!token) throw new Error("Admin session required. Please sign in again.");
    return token;
  };

  const handleReferenceFiles = async (event) => {
    const files = Array.from(event?.target?.files || []);
    if (!files.length) return;

    const available = Math.max(0, MAX_REFERENCES - references.length);
    const selected = files.slice(0, available);
    if (files.length > selected.length) {
      showToast(`Only ${MAX_REFERENCES} reference images are allowed.`);
    }

    const next = [];
    for (const file of selected) {
      try {
        const dataUrl = await optimizeReferenceImage(file);
        next.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          dataUrl,
        });
      } catch (err) {
        console.error("[marketing:reference] failed", err);
        showToast(`Could not process image: ${file.name}`);
      }
    }

    if (next.length) {
      setReferences((prev) => [...prev, ...next].slice(0, MAX_REFERENCES));
    }

    event.target.value = "";
  };

  const generateWithAi = async () => {
    if (prompt.trim().length < 8) {
      showToast("Enter a longer prompt so AI can create a quality campaign.");
      return;
    }

    setGenerating(true);
    try {
      const token = await getAccessToken();
      const smartPrompt = buildSmartPrompt({
        prompt: prompt.trim(),
        stylePreset,
        channel: activeTab,
      });

      const payload = {
        prompt: smartPrompt,
        channel: activeTab,
        platform: activeTab === TABS.email ? "email" : socialPlatform,
        stylePreset: activeTab === TABS.social ? stylePreset : "general",
        references: references.map((ref) => ref.dataUrl),
      };

      const res = await fetch("/api/marketing/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      let body = {};
      try { body = await res.json(); } catch {}

      if (!res.ok || body?.error) {
        throw new Error(body?.error || body?.details || `Request failed (${res.status})`);
      }

      const nextResult = {
        ...initialResult(),
        ...(body?.result || {}),
      };

      setResult(nextResult);
      setEmailDraft({
        subject: nextResult.emailSubject || "",
        body: nextResult.emailBody || "",
      });

      if (!campaignName.trim()) {
        setCampaignName(suggestTemplateName({ campaignName: "", headline: nextResult.headline, prompt }));
      }

      if (body?.warning) {
        showToast(`Generated with warning: ${body.warning}`);
      } else {
        showToast("Campaign generated");
      }
    } catch (err) {
      console.error("[marketing:generate] failed", err);
      showToast(`Failed to generate campaign: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const saveTemplate = async () => {
    const name = suggestTemplateName({
      campaignName,
      headline: result.headline,
      prompt,
    });
    if (!campaignName.trim()) setCampaignName(name);

    await upsertTemplate({
      name,
      prompt: prompt.trim(),
      data: {
        activeTab,
        socialPlatform,
        stylePreset,
        result: {
          ...result,
          imageDataUrl: "",
        },
        emailDraft,
      },
    });

    showToast("Template saved");
  };

  const loadTemplate = (template) => {
    const data = template?.data || {};
    setPrompt(template?.prompt || "");
    setCampaignName(template?.name || "");
    setActiveTab(data?.activeTab === TABS.email ? TABS.email : TABS.social);
    setSocialPlatform(data?.socialPlatform || "instagram");
    setStylePreset(data?.stylePreset || "local_slots");
    setResult({ ...initialResult(), ...(data?.result || {}) });
    setEmailDraft({
      subject: data?.emailDraft?.subject || data?.result?.emailSubject || "",
      body: data?.emailDraft?.body || data?.result?.emailBody || "",
    });
    showToast("Template loaded. Generate again to create a fresh poster image.");
  };

  const downloadPoster = () => {
    if (!result.imageDataUrl) {
      showToast("Generate a poster first.");
      return;
    }

    const link = document.createElement("a");
    link.href = result.imageDataUrl;
    const suffix = activeTab === TABS.email ? "email" : socialPlatform;
    link.download = fileNameFromHeadline(campaignName || result.headline, suffix);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const sendCampaignEmails = async () => {
    if (selectedRecipients.length === 0) {
      showToast("Select at least one recipient.");
      return;
    }
    if (!EMAILJS_SERVICE_ID || !EMAILJS_PUBLIC_KEY || !EMAILJS_MARKETING_TEMPLATE_ID) {
      const missing = [
        !EMAILJS_SERVICE_ID ? "VITE_EMAILJS_SERVICE_ID" : null,
        !EMAILJS_PUBLIC_KEY ? "VITE_EMAILJS_PUBLIC_KEY" : null,
        !EMAILJS_MARKETING_TEMPLATE_ID ? "VITE_EMAILJS_MARKETING_TEMPLATE_ID" : null,
      ].filter(Boolean).join(", ");
      showToast(`Marketing email is not configured (${missing}).`);
      return;
    }

    const targets = recipientOptions.filter((row) => selectedRecipients.includes(row.id));
    if (!targets.length) {
      showToast("No valid recipients selected.");
      return;
    }

    const subject = String(emailDraft.subject || result.emailSubject || "").trim();
    const body = String(emailDraft.body || result.emailBody || "").trim();
    if (!subject || !body) {
      showToast("Generate email content before sending.");
      return;
    }

    setSending(true);
    let ok = 0;
    let failed = 0;
    let firstErrorMessage = "";

    try {
      const bodyHtml = escapeHtml(body).replace(/\n/g, "<br/>");
      const headline = escapeHtml(result.headline || "Dust Bunnies Cleaning");
      const imageBytes = estimateDataUrlBytes(result.imageDataUrl);
      const inlinePosterDataUri = imageBytes > 0 && imageBytes <= MAX_EMAILJS_INLINE_IMAGE_BYTES
        ? result.imageDataUrl
        : "";
      const imageTag = inlinePosterDataUri
        ? `<img src="${inlinePosterDataUri}" alt="${headline}" style="max-width:100%;height:auto;border-radius:12px;border:1px solid #dce4d9;display:block;margin:12px 0;"/>`
        : "";
      if (result.imageDataUrl && !inlinePosterDataUri) {
        showToast("Poster is large, so emails will send without inline image to avoid delivery errors.");
      }

      for (const target of targets) {
        try {
          const firstName = escapeHtml(target.name.split(" ")[0] || target.name);
          const htmlMessage = `
            <div style="font-family:Arial,sans-serif;max-width:700px;color:#1f2f26;line-height:1.55;">
              <p style="margin:0 0 10px;">Hi ${firstName},</p>
              <p style="margin:0 0 8px;">${headline}</p>
              ${imageTag}
              <p style="margin:0 0 12px;">${bodyHtml}</p>
              <p style="margin:0;">Reply to this email to secure your booking.</p>
            </div>
          `;

          await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_MARKETING_TEMPLATE_ID,
            {
              to_email: target.email,
              to_name: target.name,
              email: target.email,
              name: target.name,
              customer_name: target.name.split(" ")[0] || target.name,
              customer_email: target.email,
              subject,
              title: subject,
              headline: result.headline || "Dust Bunnies Cleaning",
              subheadline: result.subheadline || "",
              message: htmlMessage,
              message_html: htmlMessage,
              poster_data_uri: inlinePosterDataUri || "",
              poster_url: inlinePosterDataUri || "",
              cta_text: result.cta || "Book now",
              cta_link: "",
              offer_line: result.subheadline || "",
              reply_to: import.meta.env.VITE_BUSINESS_EMAIL || target.email,
              from_name: "Dust Bunnies Cleaning",
            },
            EMAILJS_PUBLIC_KEY,
          );

          ok += 1;

          try {
            await addEmailHistory?.({
              client_id: null,
              recipient_name: target.name,
              recipient_email: target.email,
              template_type: "ai_marketing_studio",
            });
          } catch (historyErr) {
            console.warn("[marketing:email-history] failed", historyErr);
          }
        } catch (err) {
          failed += 1;
          if (!firstErrorMessage) {
            firstErrorMessage = err?.text || err?.message || "Unknown send error";
          }
          console.error("[marketing:send-email] failed", { email: target.email, err });
        }
      }
    } finally {
      setSending(false);
    }

    if (failed) {
      showToast(`Sent ${ok}, failed ${failed}${firstErrorMessage ? ` (${firstErrorMessage})` : ""}`);
    } else {
      showToast(`Sent campaign to ${ok} recipients`);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", flexDirection: isMobile ? "column" : "row", gap: 10, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>AI Marketing Studio</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>
            Prompt in, polished poster out. Tuned for local Sunshine Coast campaigns.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={downloadPoster} style={smallActionBtn}>Download Poster</button>
          <button onClick={saveTemplate} style={{ ...smallActionBtn, background: T.primary, color: "#fff", border: "none" }}>
            Save Template
          </button>
        </div>
      </div>

      <div style={{ display: "inline-flex", background: "#fff", border: `1px solid ${T.border}`, borderRadius: 12, padding: 4, gap: 4, marginBottom: 16 }}>
        <button onClick={() => setActiveTab(TABS.social)} style={{ ...tabBtnStyle, ...(activeTab === TABS.social ? tabBtnActive : null) }}>
          Instagram / Facebook
        </button>
        <button onClick={() => setActiveTab(TABS.email)} style={{ ...tabBtnStyle, ...(activeTab === TABS.email ? tabBtnActive : null) }}>
          Email Campaign
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: studioColumns, gap: 14 }}>
        <div style={cardStyle}>
          <div style={{ ...labelStyle, marginBottom: 6 }}>Campaign Brief</div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            placeholder={activeTab === TABS.email
              ? "Example: We are running a flash promo on oven cleans for $50 this week."
              : "Example: Buderim Thursday 12pm fortnightly slot available. Create a suburb slot poster."}
            style={{ ...inputStyle, resize: "vertical", minHeight: 130, lineHeight: 1.5 }}
          />

          {activeTab === TABS.social && (
            <>
              <div style={{ marginTop: 10 }}>
                <div style={labelStyle}>Style</div>
                <div style={{ display: "grid", gap: 6 }}>
                  {STYLE_PRESETS.map((preset) => {
                    const selected = stylePreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => setStylePreset(preset.id)}
                        style={{
                          border: `1px solid ${selected ? T.primary : T.border}`,
                          borderRadius: 10,
                          background: selected ? T.primaryLight : "#fff",
                          color: selected ? T.primaryDark : T.text,
                          padding: "8px 10px",
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 800 }}>{preset.label}</div>
                        <div style={{ marginTop: 2, fontSize: 11, color: T.textMuted }}>{preset.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={labelStyle}>Platform</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {SOCIAL_PLATFORMS.map((platform) => (
                    <button
                      key={platform.id}
                      onClick={() => setSocialPlatform(platform.id)}
                      style={{
                        ...smallActionBtn,
                        borderColor: socialPlatform === platform.id ? T.primary : T.border,
                        color: socialPlatform === platform.id ? T.primaryDark : T.textMuted,
                        background: socialPlatform === platform.id ? T.primaryLight : "#fff",
                      }}
                    >
                      {platform.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div style={{ marginTop: 12 }}>
            <div style={labelStyle}>Reference Images (Optional)</div>
            <input type="file" accept="image/*" multiple onChange={handleReferenceFiles} style={{ width: "100%" }} />
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
              {references.map((ref) => (
                <div key={ref.id} style={{ position: "relative", border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden", background: "#fff" }}>
                  <img src={ref.dataUrl} alt={ref.name} style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }} />
                  <button
                    onClick={() => setReferences((prev) => prev.filter((x) => x.id !== ref.id))}
                    style={{ position: "absolute", top: 4, right: 4, border: "none", borderRadius: 999, width: 20, height: 20, cursor: "pointer", background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 12 }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
            {references.length === 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: T.textLight }}>
                Upload examples/photos and AI will try to match the style.
              </div>
            )}
          </div>

          <button
            onClick={generateWithAi}
            disabled={generating}
            style={{
              marginTop: 14,
              width: "100%",
              padding: "11px 14px",
              borderRadius: 10,
              border: "none",
              background: generating ? T.border : `linear-gradient(135deg, ${T.primary}, ${T.blue})`,
              color: "#fff",
              fontWeight: 800,
              cursor: generating ? "not-allowed" : "pointer",
            }}
          >
            {generating ? "Generating..." : "Generate Poster"}
          </button>

          <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 10, border: `1px solid ${T.borderLight}`, background: T.bg }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: T.text }}>Smart Mode</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
              {activeTab === TABS.social
                ? `Using ${activeStyleMeta.label}. AI prioritizes readable suburb poster layout.`
                : "AI generates subject/body plus matching visual for email campaigns."}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={labelStyle}>Quick Ideas</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {suggestions.map((item) => (
                <button
                  key={item}
                  onClick={() => setPrompt(item)}
                  style={{ ...smallActionBtn, justifyContent: "flex-start", textAlign: "left", width: "100%" }}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => setShowAdvanced((prev) => !prev)} style={{ ...smallActionBtn, width: "100%", marginTop: 12 }}>
            {showAdvanced ? "Hide Advanced Tools" : "Show Advanced Tools"}
          </button>

          {showAdvanced && (
            <div style={{ marginTop: 10, borderTop: `1px dashed ${T.border}`, paddingTop: 10 }}>
              <div style={labelStyle}>Template Name</div>
              <input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Optional (auto-generated if blank)"
                style={inputStyle}
              />
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 10, background: "#fff" }}>
            {result.imageDataUrl ? (
              <img
                src={result.imageDataUrl}
                alt={result.headline || "AI marketing poster"}
                style={{ width: "100%", borderRadius: 10, border: `1px solid ${T.border}`, display: "block", objectFit: "cover" }}
              />
            ) : (
              <div style={{ padding: "42px 18px", textAlign: "center", color: T.textLight, fontSize: 13 }}>
                Generate to preview your AI poster.
              </div>
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={labelStyle}>Headline</div>
            <div style={readOnlyValueStyle}>{result.headline || "-"}</div>
            <div style={{ marginTop: 8 }}>
              <div style={labelStyle}>Subheadline</div>
              <div style={readOnlyValueStyle}>{result.subheadline || "-"}</div>
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={labelStyle}>Call To Action</div>
              <div style={readOnlyValueStyle}>{result.cta || "-"}</div>
            </div>
          </div>

          {activeTab === TABS.social && showAdvanced && (
            <div style={{ marginTop: 12 }}>
              <div style={labelStyle}>Caption</div>
              <textarea
                value={result.caption || ""}
                onChange={(e) => setResult((prev) => ({ ...prev, caption: e.target.value }))}
                rows={5}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
              />
              <div style={{ marginTop: 8 }}>
                <div style={labelStyle}>Hashtags</div>
                <textarea
                  value={(result.hashtags || []).join(" ")}
                  onChange={(e) => setResult((prev) => ({
                    ...prev,
                    hashtags: String(e.target.value || "")
                      .split(/\s+/)
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  }))}
                  rows={2}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
            </div>
          )}

          {activeTab === TABS.email && (
            <div style={{ marginTop: 12 }}>
              <div style={labelStyle}>Email Subject</div>
              <input
                value={emailDraft.subject}
                onChange={(e) => setEmailDraft((prev) => ({ ...prev, subject: e.target.value }))}
                style={inputStyle}
              />
              <div style={{ marginTop: 8 }}>
                <div style={labelStyle}>Email Body</div>
                <textarea
                  value={emailDraft.body}
                  onChange={(e) => setEmailDraft((prev) => ({ ...prev, body: e.target.value }))}
                  rows={8}
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
                />
              </div>
            </div>
          )}
        </div>

        <div style={cardStyle}>
          {activeTab === TABS.email && (
            <>
              <div style={labelStyle}>Recipients</div>
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, maxHeight: 220, overflow: "auto", marginBottom: 8 }}>
                {recipientOptions.map((recipient) => {
                  const selected = selectedRecipients.includes(recipient.id);
                  return (
                    <button
                      key={recipient.id}
                      onClick={() => setSelectedRecipients((prev) => selected
                        ? prev.filter((id) => id !== recipient.id)
                        : [...prev, recipient.id])}
                      style={{
                        width: "100%",
                        border: "none",
                        borderBottom: `1px solid ${T.borderLight}`,
                        background: selected ? T.primaryLight : "#fff",
                        textAlign: "left",
                        padding: "8px 10px",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{recipient.name}</div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>{recipient.email} · {recipient.source}</div>
                    </button>
                  );
                })}
                {recipientOptions.length === 0 && (
                  <div style={{ padding: 12, fontSize: 12, color: T.textLight }}>No recipients with valid email yet.</div>
                )}
              </div>

              <button
                onClick={sendCampaignEmails}
                disabled={sending || selectedRecipients.length === 0}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "none",
                  background: selectedRecipients.length === 0 ? T.border : T.primary,
                  color: "#fff",
                  fontWeight: 800,
                  cursor: selectedRecipients.length === 0 ? "not-allowed" : "pointer",
                  opacity: sending ? 0.7 : 1,
                  marginBottom: 14,
                }}
              >
                {sending ? "Sending..." : `Send to ${selectedRecipients.length} recipient${selectedRecipients.length === 1 ? "" : "s"}`}
              </button>
            </>
          )}

          <TemplateList
            templates={templates}
            loading={loading}
            usingLocal={usingLocal}
            loadTemplate={loadTemplate}
            removeTemplate={removeTemplate}
          />
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "#fff",
  borderRadius: T.radius,
  boxShadow: T.shadow,
  padding: 14,
  alignSelf: "start",
};

const labelStyle = {
  fontSize: 11,
  fontWeight: 700,
  color: T.textMuted,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 4,
};

const inputStyle = {
  width: "100%",
  border: `1.5px solid ${T.border}`,
  borderRadius: 10,
  padding: "9px 10px",
  fontSize: 13,
  color: T.text,
  boxSizing: "border-box",
  background: "#fff",
};

const readOnlyValueStyle = {
  border: `1px solid ${T.borderLight}`,
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: 13,
  color: T.text,
  background: T.bg,
  minHeight: 36,
};

const smallActionBtn = {
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  background: "#fff",
  color: T.textMuted,
  padding: "6px 9px",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
};

const tabBtnStyle = {
  border: "none",
  borderRadius: 8,
  padding: "8px 12px",
  background: "transparent",
  color: T.textMuted,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const tabBtnActive = {
  background: T.primaryLight,
  color: T.primaryDark,
};
