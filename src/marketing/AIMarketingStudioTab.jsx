import React, { useMemo, useState } from "react";
import emailjs from "@emailjs/browser";
import { T, SERVICED_AREAS } from "../shared";
import { useMarketingTemplates } from "../hooks/useMarketingTemplates";

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const EMAILJS_MARKETING_TEMPLATE_ID =
  import.meta.env.VITE_EMAILJS_MARKETING_TEMPLATE_ID ||
  import.meta.env.VITE_EMAILJS_UNIVERSAL_TEMPLATE_ID ||
  import.meta.env.VITE_EMAILJS_TEMPLATE_ID;

const PLATFORM_PRESETS = {
  instagram_post: { id: "instagram_post", label: "Instagram Post", width: 1080, height: 1080, ratio: "1:1" },
  facebook_post: { id: "facebook_post", label: "Facebook Feed", width: 1200, height: 630, ratio: "1.91:1" },
  instagram_story: { id: "instagram_story", label: "Instagram Story", width: 1080, height: 1920, ratio: "9:16" },
  email_banner: { id: "email_banner", label: "Email Poster", width: 1200, height: 675, ratio: "16:9" },
};

const CREATIVE_MODES = [
  { id: "local_urgency", label: "Local Urgency", helper: "Drive quick bookings in a specific suburb or day." },
  { id: "premium", label: "Premium Trust", helper: "Position as reliable, high-quality, professional cleaning." },
  { id: "eco", label: "Eco Focus", helper: "Highlight non-toxic, eco-conscious cleaning value." },
  { id: "promo", label: "Flash Promo", helper: "Strong CTA and limited-time deal conversion." },
];

const PALETTES = [
  { id: "earth", label: "Earth Moss", bgA: "#16392B", bgB: "#5B7F62", accent: "#C8A765", text: "#F6F7F3", detail: "#D8E4D8" },
  { id: "coast", label: "Coastal Teal", bgA: "#1E4952", bgB: "#4F7D82", accent: "#E8C86A", text: "#F7F9FA", detail: "#D6E8E9" },
  { id: "warm", label: "Warm Clay", bgA: "#553A2A", bgB: "#8C5A3B", accent: "#E8C86A", text: "#FFF9F4", detail: "#F4E4D4" },
];

const MARKETING_HOOKS = [
  "Limited spots this week",
  "Book now before schedule fills",
  "Trusted local cleaners on the Sunshine Coast",
  "Quick turnaround and consistent quality",
  "Message us now to lock in your clean",
];

const isLikelyEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

function wrapText(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) current = next;
    else {
      if (current) lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function detectPrice(text) {
  const match = text.match(/(?:\$|aud\s?)(\d{2,4})/i);
  return match ? Number(match[1]) : null;
}

function detectSuburb(text) {
  const lower = text.toLowerCase();
  const known = SERVICED_AREAS.find((suburb) => lower.includes(suburb.toLowerCase()));
  if (known) return known;
  const generic = text.match(/\bin\s+([a-z][a-z\s'-]{2,30})(?:\s+(?:on|for|this|next|with|before|after)|$)/i);
  if (generic) return generic[1].replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
  return "";
}

function detectDay(text) {
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const found = days.find((day) => text.toLowerCase().includes(day));
  return found ? found.charAt(0).toUpperCase() + found.slice(1) : "";
}

function detectService(text) {
  const lower = text.toLowerCase();
  if (lower.includes("oven")) return "Oven Clean";
  if (lower.includes("bond")) return "Bond Clean";
  if (lower.includes("deep")) return "Deep Clean";
  if (lower.includes("window")) return "Window Clean";
  if (lower.includes("regular")) return "Regular Home Clean";
  return "Professional House Clean";
}

function buildCampaignFromPrompt({ prompt, mode, paletteId }) {
  const cleanPrompt = String(prompt || "").trim();
  const lower = cleanPrompt.toLowerCase();
  const suburb = detectSuburb(cleanPrompt);
  const day = detectDay(cleanPrompt);
  const service = detectService(cleanPrompt);
  const price = detectPrice(cleanPrompt);
  const hasSlotsIntent = /slot|available|opening|space|vacanc/i.test(lower);
  const hasPromoIntent = /promo|discount|flash|deal|offer|save/i.test(lower);
  const timeWindowMatch = cleanPrompt.match(/(today|this week|next week|this weekend|for the next [a-z0-9\s-]+)/i);
  const windowText = timeWindowMatch ? timeWindowMatch[1] : "this week";

  let headline = "";
  let subheadline = "";
  let offerLine = "";
  let cta = "";

  if (hasPromoIntent || mode === "promo") {
    headline = price ? `${service} Special - $${price}` : `${service} Flash Promo`;
    subheadline = suburb ? `${suburb} clients only • ${windowText}` : `Limited-time offer • ${windowText}`;
    offerLine = price ? `Book now for $${price} (limited run)` : "Limited-time special pricing";
    cta = "Message us now to claim this offer";
  } else if (hasSlotsIntent || mode === "local_urgency") {
    headline = suburb ? `${suburb} ${day || ""} Spots Open`.trim() : `${day || "This Week"} Spots Open`;
    subheadline = `${service} slots now available ${day ? `on ${day}` : windowText}`;
    offerLine = "Priority booking available for quick responses";
    cta = "Reply now and lock your clean in";
  } else if (mode === "eco") {
    headline = `Eco-Friendly ${service}`;
    subheadline = suburb ? `Now booking in ${suburb}` : "Sunshine Coast bookings open";
    offerLine = "Non-toxic products • detailed finish • reliable team";
    cta = "Book a greener clean today";
  } else {
    headline = `Need a Reliable ${service}?`;
    subheadline = suburb ? `${suburb} bookings available` : "Sunshine Coast bookings now open";
    offerLine = "Trusted local team with consistent quality";
    cta = "Enquire now for your quote";
  }

  const angle = mode === "premium"
    ? "Professional, punctual, and detail-focused service."
    : mode === "eco"
      ? "Eco-conscious cleans that still deliver a premium finish."
      : "Fast-response local cleaning with easy booking.";

  const hooks = [
    `${headline}`,
    `${offerLine}`,
    `${suburb ? `Serving ${suburb} and nearby suburbs` : "Local Sunshine Coast team"}`,
    ...MARKETING_HOOKS.slice(0, 2),
  ];

  const emailSubject = price
    ? `${service} special - $${price} for a limited time`
    : `${suburb ? `${suburb} ` : ""}${service} slots available ${day ? `on ${day}` : "this week"}`.trim();

  const emailBody = [
    `Hi {NAME},`,
    "",
    `${headline}`,
    `${subheadline}`,
    "",
    `${angle}`,
    offerLine,
    "",
    `${cta}.`,
    "",
    "Reply to this email and we'll secure your booking.",
  ].join("\n");

  return {
    prompt: cleanPrompt,
    mode,
    paletteId,
    headline,
    subheadline,
    offerLine,
    cta,
    service,
    suburb,
    day,
    timeWindow: windowText,
    price,
    hooks,
    hashtags: ["#sunshinecoast", "#cleaningservice", "#localbusiness", "#dustbunniescleaning"],
    emailSubject,
    emailBody,
    channels: ["Instagram", "Facebook", "Email"],
  };
}

function createPosterDataUrl(campaign, palette, preset, options = {}) {
  const mimeType = options.mimeType || "image/png";
  const quality = typeof options.quality === "number" ? options.quality : undefined;
  const canvas = document.createElement("canvas");
  canvas.width = preset.width;
  canvas.height = preset.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Poster canvas could not initialize.");

  const gradient = ctx.createLinearGradient(0, 0, preset.width, preset.height);
  gradient.addColorStop(0, palette.bgA);
  gradient.addColorStop(1, palette.bgB);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, preset.width, preset.height);

  ctx.globalAlpha = 0.14;
  ctx.fillStyle = "#ffffff";
  drawRoundedRect(ctx, preset.width * 0.05, preset.height * 0.1, preset.width * 0.5, preset.height * 0.26, 28);
  ctx.fill();
  drawRoundedRect(ctx, preset.width * 0.5, preset.height * 0.55, preset.width * 0.43, preset.height * 0.34, 28);
  ctx.fill();
  ctx.globalAlpha = 1;

  const safePad = Math.round(preset.width * 0.065);
  let y = Math.round(preset.height * 0.12);

  ctx.fillStyle = palette.accent;
  ctx.font = `700 ${Math.round(preset.width * 0.032)}px Arial`;
  ctx.fillText("DUST BUNNIES CLEANING", safePad, y);
  y += Math.round(preset.height * 0.08);

  ctx.fillStyle = palette.text;
  ctx.font = `900 ${Math.round(preset.width * 0.075)}px Arial`;
  wrapText(ctx, campaign.headline, preset.width - safePad * 2).slice(0, 3).forEach((line) => {
    ctx.fillText(line, safePad, y);
    y += Math.round(preset.height * 0.085);
  });

  ctx.fillStyle = palette.detail;
  ctx.font = `600 ${Math.round(preset.width * 0.036)}px Arial`;
  wrapText(ctx, campaign.subheadline, preset.width - safePad * 2).slice(0, 3).forEach((line) => {
    ctx.fillText(line, safePad, y);
    y += Math.round(preset.height * 0.055);
  });

  y += Math.round(preset.height * 0.03);
  ctx.fillStyle = palette.text;
  ctx.font = `700 ${Math.round(preset.width * 0.034)}px Arial`;
  wrapText(ctx, campaign.offerLine, preset.width - safePad * 2).slice(0, 2).forEach((line) => {
    ctx.fillText(line, safePad, y);
    y += Math.round(preset.height * 0.05);
  });

  const badgeW = Math.round(preset.width * 0.36);
  const badgeH = Math.round(preset.height * 0.1);
  const badgeX = preset.width - safePad - badgeW;
  const badgeY = preset.height - safePad - badgeH;
  ctx.fillStyle = palette.accent;
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 18);
  ctx.fill();

  ctx.fillStyle = "#1d2d24";
  ctx.font = `900 ${Math.round(preset.width * 0.028)}px Arial`;
  ctx.fillText(campaign.cta.toUpperCase(), badgeX + 18, badgeY + Math.round(badgeH * 0.62));

  return canvas.toDataURL(mimeType, quality);
}

function fileNameFromCampaign(name, presetId) {
  const base = String(name || "campaign")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48) || "campaign";
  return `${base}-${presetId}.png`;
}

export default function AIMarketingStudioTab({
  clients,
  enquiries,
  addEmailHistory,
  showToast,
  isMobile,
}) {
  const { templates, loading, usingLocal, upsertTemplate, removeTemplate } = useMarketingTemplates();

  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState("local_urgency");
  const [paletteId, setPaletteId] = useState("earth");
  const [presetId, setPresetId] = useState("instagram_post");
  const [campaignName, setCampaignName] = useState("");
  const [campaign, setCampaign] = useState(() => buildCampaignFromPrompt({ prompt: "", mode: "local_urgency", paletteId: "earth" }));
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [sending, setSending] = useState(false);

  const preset = PLATFORM_PRESETS[presetId] || PLATFORM_PRESETS.instagram_post;
  const palette = PALETTES.find((p) => p.id === paletteId) || PALETTES[0];

  const posterPreviewUrl = useMemo(() => {
    try {
      return createPosterDataUrl(campaign, palette, preset);
    } catch {
      return "";
    }
  }, [campaign, palette, preset]);

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
    return Array.from(byEmail.values()).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 400);
  }, [clients, enquiries]);

  const suggestionCards = useMemo(() => {
    const suburbCounts = {};
    (clients || []).forEach((client) => {
      const suburb = String(client?.suburb || "").trim();
      if (!suburb) return;
      suburbCounts[suburb] = (suburbCounts[suburb] || 0) + 1;
    });
    const topSuburb = Object.entries(suburbCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Maroochydore";
    return [
      `Fill Friday slots in ${topSuburb} with a 48-hour booking push`,
      "Run a weekly-to-fortnightly upgrade campaign for existing clients",
      "Promote oven + kitchen reset bundle before weekend",
      "Post before/after proof campaign with quick CTA",
    ];
  }, [clients]);

  const runGenerator = () => {
    const generated = buildCampaignFromPrompt({ prompt, mode, paletteId });
    setCampaign(generated);
    if (!campaignName.trim()) {
      setCampaignName(generated.headline.slice(0, 42));
    }
    showToast("✨ Campaign generated");
  };

  const downloadPoster = async (targetPresetId) => {
    const selectedPreset = PLATFORM_PRESETS[targetPresetId] || preset;
    const dataUrl = createPosterDataUrl(campaign, palette, selectedPreset);
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = fileNameFromCampaign(campaignName || campaign.headline, selectedPreset.id);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const saveTemplate = async () => {
    if (!campaignName.trim()) {
      showToast("⚠️ Name this campaign before saving.");
      return;
    }
    await upsertTemplate({
      name: campaignName.trim(),
      prompt: prompt.trim(),
      data: {
        campaign,
        mode,
        paletteId,
        presetId,
      },
    });
    showToast("✅ Campaign template saved");
  };

  const loadTemplate = (row) => {
    const data = row?.data || {};
    setCampaign(data.campaign || campaign);
    setMode(data.mode || "local_urgency");
    setPaletteId(data.paletteId || "earth");
    setPresetId(data.presetId || "instagram_post");
    setPrompt(row?.prompt || "");
    setCampaignName(row?.name || "");
    showToast(`Loaded "${row?.name || "campaign"}"`);
  };

  const sendCampaignEmails = async () => {
    if (selectedRecipients.length === 0) {
      showToast("⚠️ Select at least one recipient");
      return;
    }
    if (!EMAILJS_SERVICE_ID || !EMAILJS_PUBLIC_KEY || !EMAILJS_MARKETING_TEMPLATE_ID) {
      showToast("❌ Email is not configured for marketing studio");
      return;
    }

    const targets = recipientOptions.filter((row) => selectedRecipients.includes(row.id));
    if (!targets.length) {
      showToast("⚠️ No valid recipients selected");
      return;
    }

    setSending(true);
    let ok = 0;
    let failed = 0;

    try {
      const posterDataUri = createPosterDataUrl(
        campaign,
        palette,
        PLATFORM_PRESETS.email_banner,
        { mimeType: "image/jpeg", quality: 0.84 },
      );
      const safeFirstNameToken = "{NAME}";
      const safeBodyHtml = escapeHtml(campaign.emailBody)
        .replace(/\{NAME\}/g, safeFirstNameToken)
        .replace(/\n/g, "<br/>");
      const htmlMessage = `
        <div style="font-family:Arial,sans-serif;max-width:680px">
          <p style="margin:0 0 12px">Hi ${safeFirstNameToken},</p>
          <p style="margin:0 0 16px">${safeBodyHtml}</p>
          <img src="${posterDataUri}" alt="${escapeHtml(campaign.headline)}" style="max-width:100%;height:auto;border-radius:12px;border:1px solid #dce4d9;display:block" />
          <p style="margin:16px 0 0">${escapeHtml(campaign.cta)}.</p>
        </div>
      `;

      for (const target of targets) {
        try {
          await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_MARKETING_TEMPLATE_ID, {
            to_email: target.email,
            to_name: target.name,
            customer_name: target.name.split(" ")[0] || target.name,
            customer_email: target.email,
            subject: campaign.emailSubject,
            headline: campaign.headline,
            message: htmlMessage.replace(safeFirstNameToken, escapeHtml(target.name.split(" ")[0] || target.name)),
            poster_data_uri: posterDataUri,
            cta_text: campaign.cta,
            offer_line: campaign.offerLine,
            reply_to: import.meta.env.VITE_BUSINESS_EMAIL || target.email,
          }, EMAILJS_PUBLIC_KEY);
          ok += 1;
          try {
            await addEmailHistory?.({
              client_id: null,
              recipient_name: target.name,
              recipient_email: target.email,
              template_type: "ai_marketing_studio",
              custom_style: palette.id,
            });
          } catch (historyErr) {
            console.warn("[marketing-studio:email-history] failed", { email: target.email, historyErr });
          }
        } catch (err) {
          console.error("[marketing-studio:email] failed", { email: target.email, err });
          failed += 1;
        }
      }
    } finally {
      setSending(false);
    }

    showToast(failed ? `⚠️ Sent ${ok}, failed ${failed}` : `✅ Sent campaign to ${ok} recipients`);
  };

  return (
    <div>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>AI Marketing Studio</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>
            Prompt-to-poster campaign builder for social and email conversion
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => downloadPoster("instagram_post")} style={smallActionBtn}>Download IG</button>
          <button onClick={() => downloadPoster("facebook_post")} style={smallActionBtn}>Download FB</button>
          <button onClick={saveTemplate} style={{ ...smallActionBtn, background: T.primary, color: "#fff", border: "none" }}>Save Template</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "340px 1fr 320px", gap: 16 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>Campaign Prompt</div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={6}
            placeholder={`Example: We have some slots available in Mudjimba on Fridays help me advertise this`}
            style={{ ...inputStyle, resize: "vertical", minHeight: 130, lineHeight: 1.5 }}
          />

          <div style={{ marginTop: 10 }}>
            <div style={labelStyle}>Creative Mode</div>
            <select value={mode} onChange={(e) => setMode(e.target.value)} style={inputStyle}>
              {CREATIVE_MODES.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}
            </select>
            <div style={{ marginTop: 4, fontSize: 11, color: T.textLight }}>
              {CREATIVE_MODES.find((row) => row.id === mode)?.helper}
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={labelStyle}>Poster Palette</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PALETTES.map((row) => (
                <button
                  key={row.id}
                  onClick={() => setPaletteId(row.id)}
                  style={{
                    border: paletteId === row.id ? `2px solid ${T.primary}` : `1px solid ${T.border}`,
                    borderRadius: 10,
                    background: "#fff",
                    padding: 6,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex" }}>
                    <div style={{ width: 20, height: 18, background: row.bgA, borderRadius: "6px 0 0 6px" }} />
                    <div style={{ width: 20, height: 18, background: row.bgB }} />
                    <div style={{ width: 20, height: 18, background: row.accent, borderRadius: "0 6px 6px 0" }} />
                  </div>
                  <div style={{ marginTop: 4, fontSize: 10, color: T.textMuted, fontWeight: 700 }}>{row.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={labelStyle}>Output Size</div>
            <select value={presetId} onChange={(e) => setPresetId(e.target.value)} style={inputStyle}>
              {Object.values(PLATFORM_PRESETS).map((row) => (
                <option key={row.id} value={row.id}>{row.label} ({row.width}x{row.height})</option>
              ))}
            </select>
          </div>

          <button onClick={runGenerator} style={{ marginTop: 12, width: "100%", padding: "12px 14px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${T.primary}, ${T.blue})`, color: "#fff", fontWeight: 800, cursor: "pointer" }}>
            Generate Campaign
          </button>

          <div style={{ marginTop: 14 }}>
            <div style={labelStyle}>Suggested Promo Angles</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {suggestionCards.map((text) => (
                <button key={text} onClick={() => setPrompt(text)} style={{ ...smallActionBtn, justifyContent: "flex-start", textAlign: "left", width: "100%" }}>
                  {text}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
            <input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Campaign template name"
              style={{ ...inputStyle, flex: 1, minWidth: 180 }}
            />
            <button onClick={() => downloadPoster(presetId)} style={smallActionBtn}>Download {preset.ratio}</button>
          </div>

          <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, background: "#fff" }}>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 8 }}>
              Preview: {preset.label} ({preset.width}x{preset.height})
            </div>
            {posterPreviewUrl ? (
              <img
                src={posterPreviewUrl}
                alt="Campaign poster preview"
                style={{ width: "100%", borderRadius: 10, border: `1px solid ${T.border}`, objectFit: "cover", aspectRatio: `${preset.width}/${preset.height}` }}
              />
            ) : (
              <div style={{ padding: 30, textAlign: "center", color: T.textLight }}>Generate campaign to preview poster</div>
            )}
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div>
              <div style={labelStyle}>Headline</div>
              <input value={campaign.headline} onChange={(e) => setCampaign((prev) => ({ ...prev, headline: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Subheadline</div>
              <input value={campaign.subheadline} onChange={(e) => setCampaign((prev) => ({ ...prev, subheadline: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Offer Line</div>
              <input value={campaign.offerLine} onChange={(e) => setCampaign((prev) => ({ ...prev, offerLine: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>CTA</div>
              <input value={campaign.cta} onChange={(e) => setCampaign((prev) => ({ ...prev, cta: e.target.value }))} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={labelStyle}>Email Subject</div>
            <input value={campaign.emailSubject} onChange={(e) => setCampaign((prev) => ({ ...prev, emailSubject: e.target.value }))} style={inputStyle} />
            <div style={{ marginTop: 8 }}>
              <div style={labelStyle}>Email Body</div>
              <textarea value={campaign.emailBody} onChange={(e) => setCampaign((prev) => ({ ...prev, emailBody: e.target.value }))} rows={6} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Send Campaign Email</div>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>
            Select clients/leads and send your generated visual poster by email.
          </div>
          <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, maxHeight: 210, overflow: "auto", marginBottom: 10 }}>
            {recipientOptions.map((recipient) => {
              const selected = selectedRecipients.includes(recipient.id);
              return (
                <button
                  key={recipient.id}
                  onClick={() => setSelectedRecipients((prev) => selected ? prev.filter((id) => id !== recipient.id) : [...prev, recipient.id])}
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
                  <div style={{ fontSize: 11, color: T.textMuted }}>{recipient.email} • {recipient.source}</div>
                </button>
              );
            })}
            {recipientOptions.length === 0 && (
              <div style={{ padding: 12, fontSize: 12, color: T.textLight }}>No recipients with valid email yet.</div>
            )}
          </div>
          <button onClick={sendCampaignEmails} disabled={sending || selectedRecipients.length === 0} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "none", background: selectedRecipients.length === 0 ? T.border : T.primary, color: "#fff", fontWeight: 800, cursor: selectedRecipients.length === 0 ? "not-allowed" : "pointer", opacity: sending ? 0.7 : 1 }}>
            {sending ? "Sending..." : `Send to ${selectedRecipients.length} recipient${selectedRecipients.length === 1 ? "" : "s"}`}
          </button>

          <div style={{ marginTop: 14 }}>
            <div style={labelStyle}>Hooks & Captions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(campaign.hooks || []).map((line) => (
                <div key={line} style={{ fontSize: 12, color: T.text, background: T.bg, borderRadius: 8, padding: "7px 9px" }}>
                  {line}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: T.textMuted }}>
              {(campaign.hashtags || []).join(" ")}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={labelStyle}>Saved Templates</div>
              <div style={{ fontSize: 10, color: T.textLight }}>{usingLocal ? "Local save mode" : "Cloud sync mode"}</div>
            </div>
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, maxHeight: 220, overflow: "auto" }}>
              {loading && <div style={{ padding: 10, fontSize: 12, color: T.textMuted }}>Loading...</div>}
              {!loading && templates.length === 0 && <div style={{ padding: 10, fontSize: 12, color: T.textLight }}>No saved templates yet.</div>}
              {!loading && templates.map((row) => (
                <div key={row.id} style={{ padding: "8px 10px", borderBottom: `1px solid ${T.borderLight}` }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: T.text }}>{row.name}</div>
                  <div style={{ fontSize: 11, color: T.textLight, margin: "3px 0 6px" }}>{new Date(row.updated_at).toLocaleDateString("en-AU")}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => loadTemplate(row)} style={smallActionBtn}>Load</button>
                    <button onClick={() => removeTemplate(row.id)} style={{ ...smallActionBtn, color: T.danger }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
