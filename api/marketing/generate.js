import { getAdminClient } from "../_lib/supabaseAdmin.js";
import { requireAdmin, requireProfile } from "../_lib/auth.js";
import { ApiError, parseJsonBody, sendJson } from "../_lib/http.js";
import { runApiSecurity } from "../_lib/security.js";

const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const TEXT_MODEL = process.env.AI_MARKETING_TEXT_MODEL || "gpt-4.1-mini";
const IMAGE_MODEL = process.env.AI_MARKETING_IMAGE_MODEL || "gpt-image-1";

const PLATFORM_META = {
  instagram: { size: "1024x1024", label: "Instagram Post" },
  facebook: { size: "1536x1024", label: "Facebook Feed" },
  email: { size: "1536x1024", label: "Email Banner" },
};

const EXPENSE_CATEGORY_OPTIONS = new Set([
  "supplies",
  "travel",
  "equipment",
  "marketing",
  "software",
  "insurance",
  "utilities",
  "wages",
  "rent",
  "other",
  "uncategorized",
]);

function toStringValue(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function bytesFromDataUrl(dataUrl) {
  const payload = String(dataUrl || "").split(",")[1] || "";
  return Math.ceil((payload.length * 3) / 4);
}

function sanitizeReferences(input) {
  if (!Array.isArray(input)) return [];
  const refs = [];
  for (const value of input.slice(0, 3)) {
    const url = toStringValue(value);
    if (!url) continue;
    if (!/^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(url)) {
      throw new ApiError(400, "Each reference image must be a valid base64 data URL.");
    }
    const approxBytes = bytesFromDataUrl(url);
    if (approxBytes > 2_500_000) {
      throw new ApiError(400, "Reference image is too large. Keep each image under ~2.5MB.");
    }
    refs.push(url);
  }
  return refs;
}

function cleanJsonText(raw) {
  return String(raw || "")
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
}

function normalizeCopyPayload(payload, { prompt, channel, platform }) {
  const hashtagsInput = Array.isArray(payload?.hashtags) ? payload.hashtags : [];
  const hashtags = hashtagsInput
    .map((tag) => String(tag || "").trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag.replace(/\s+/g, "")}`));
  const fallbackHashtags = ["#sunshinecoast", "#cleaningservice", "#localbusiness"];

  return {
    prompt,
    channel,
    platform,
    headline: toStringValue(payload?.headline, "Fresh spots open this week"),
    subheadline: toStringValue(payload?.subheadline, "Book your clean with Dust Bunnies Cleaning"),
    cta: toStringValue(payload?.cta, "Book now"),
    caption: toStringValue(payload?.caption, "Local, reliable cleaning with limited spots available."),
    emailSubject: toStringValue(payload?.email_subject, "Limited cleaning spots available this week"),
    emailBody: toStringValue(payload?.email_body, "Hi there,\n\nWe have limited cleaning spots available this week.\n\nReply to secure your booking."),
    posterPrompt: toStringValue(
      payload?.poster_prompt,
      "Create a clean, modern promotional poster for Dust Bunnies Cleaning in earthy green tones with clear headline and CTA."
    ),
    hashtags: hashtags.length ? hashtags : fallbackHashtags,
  };
}

function getOpenAiApiKey() {
  return String(
    process.env.OPENAI_API_KEY
    || process.env.OPENAI_KEY
    || process.env.OPENAI_TOKEN
    || process.env.VITE_OPENAI_API_KEY
    || ""
  ).trim();
}

function escapeXml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pickSuburbFromPrompt(prompt) {
  const suburbs = [
    "Mudjimba", "Maroochydore", "Buderim", "Mooloolaba", "Noosa Heads", "Caloundra",
    "Kawana Waters", "Birtinya", "Sippy Downs", "Alexandra Headland", "Mountain Creek",
    "Minyama", "Twin Waters", "Forest Glen", "Mons", "Kuluin",
  ];
  const haystack = String(prompt || "").toLowerCase();
  return suburbs.find((s) => haystack.includes(s.toLowerCase())) || "Sunshine Coast";
}

function pickServiceFromPrompt(prompt) {
  const haystack = String(prompt || "").toLowerCase();
  if (haystack.includes("oven")) return "Oven Clean";
  if (haystack.includes("bond") || haystack.includes("end-of-lease")) return "Bond Clean";
  if (haystack.includes("deep")) return "Deep Clean";
  if (haystack.includes("standard")) return "Standard Clean";
  return "Home Clean";
}

function buildFallbackCopy({ prompt, channel, platform }) {
  const suburb = pickSuburbFromPrompt(prompt);
  const service = pickServiceFromPrompt(prompt);
  const hasPromo = /\b(promo|special|flash|discount|offer|deal|\$|\d+%|save)\b/i.test(prompt);
  const hasSlots = /\b(slot|availability|available|openings|spaces?)\b/i.test(prompt);

  const headline = hasPromo
    ? `${service} Special in ${suburb}`
    : hasSlots
      ? `Limited Cleaning Spots in ${suburb}`
      : `Fresh Cleaning Availability in ${suburb}`;
  const subheadline = hasPromo
    ? "Limited-time offer from Dust Bunnies Cleaning"
    : "Eco-conscious local cleaning with trusted results";
  const cta = hasPromo ? "Claim Offer" : "Book Your Spot";
  const caption = [
    `Need reliable cleaning in ${suburb}?`,
    hasPromo ? "We are running a limited-time promotion." : "We have new booking availability this week.",
    "Reply now to secure your preferred time.",
  ].join(" ");
  const emailSubject = hasPromo
    ? `${service} promo now available in ${suburb}`
    : `New cleaning availability in ${suburb}`;
  const emailBody = [
    `Hi there,`,
    ``,
    `Dust Bunnies Cleaning now has ${hasSlots ? "new spots" : "availability"} in ${suburb}.`,
    hasPromo ? `We are currently running a promotion on ${service.toLowerCase()} bookings.` : `This is a great time to book your next ${service.toLowerCase()}.`,
    ``,
    `Reply to this email and we will lock in a time that suits you.`,
  ].join("\n");

  return normalizeCopyPayload({
    headline,
    subheadline,
    cta,
    caption,
    email_subject: emailSubject,
    email_body: emailBody,
    poster_prompt: `Earthy themed local cleaning promotion in ${suburb} for ${service}.`,
    hashtags: [
      "#sunshinecoast",
      `#${suburb.replace(/\s+/g, "").toLowerCase()}`,
      "#cleaningservice",
      "#dustbunniescleaning",
      hasPromo ? "#specialoffer" : "#booknow",
    ],
  }, { prompt, channel, platform });
}

function fallbackPosterDataUrl({ headline, subheadline, cta, platform }) {
  const size = PLATFORM_META[platform]?.size || "1024x1024";
  const [rawW, rawH] = String(size).split("x").map((n) => Number(n));
  const width = Number.isFinite(rawW) ? rawW : 1024;
  const height = Number.isFinite(rawH) ? rawH : 1024;
  const headlineEsc = escapeXml(headline || "Dust Bunnies Cleaning");
  const subEsc = escapeXml(subheadline || "Eco-conscious cleaning");
  const ctaEsc = escapeXml(cta || "Book now");

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#E9F0E6"/>
        <stop offset="100%" stop-color="#CFE2D6"/>
      </linearGradient>
      <linearGradient id="badge" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#4F7A62"/>
        <stop offset="100%" stop-color="#3D6A54"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <circle cx="${Math.round(width * 0.87)}" cy="${Math.round(height * 0.14)}" r="${Math.round(Math.min(width, height) * 0.16)}" fill="#DCEBDD"/>
    <rect x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.11)}" width="${Math.round(width * 0.84)}" height="${Math.round(height * 0.78)}" rx="26" fill="#FFFFFF" opacity="0.94"/>
    <text x="${Math.round(width * 0.12)}" y="${Math.round(height * 0.24)}" fill="#2A3A33" font-family="Arial, sans-serif" font-weight="800" font-size="${Math.round(Math.min(width, height) * 0.06)}">${headlineEsc}</text>
    <text x="${Math.round(width * 0.12)}" y="${Math.round(height * 0.33)}" fill="#486056" font-family="Arial, sans-serif" font-weight="500" font-size="${Math.round(Math.min(width, height) * 0.03)}">${subEsc}</text>
    <rect x="${Math.round(width * 0.12)}" y="${Math.round(height * 0.62)}" width="${Math.round(width * 0.36)}" height="${Math.round(height * 0.11)}" rx="16" fill="url(#badge)"/>
    <text x="${Math.round(width * 0.18)}" y="${Math.round(height * 0.69)}" fill="#FFFFFF" font-family="Arial, sans-serif" font-weight="700" font-size="${Math.round(Math.min(width, height) * 0.032)}">${ctaEsc}</text>
    <text x="${Math.round(width * 0.12)}" y="${Math.round(height * 0.84)}" fill="#6A7A72" font-family="Arial, sans-serif" font-weight="600" font-size="${Math.round(Math.min(width, height) * 0.024)}">Dust Bunnies Cleaning</text>
  </svg>`;

  const b64 = Buffer.from(svg, "utf8").toString("base64");
  return `data:image/svg+xml;base64,${b64}`;
}

function normalizeExpenseCategory(value) {
  const key = String(value || "").trim().toLowerCase();
  return EXPENSE_CATEGORY_OPTIONS.has(key) ? key : "uncategorized";
}

function detectExpenseCategory(text) {
  const haystack = String(text || "").toLowerCase();
  const rules = [
    { id: "travel", re: /(bp|caltex|shell|fuel|petrol|diesel|uber|toll|parking|rego|mechanic|tyre|service)/ },
    { id: "supplies", re: /(bunnings|woolworths|coles|aldi|iga|clean|detergent|bleach|microfibre|mop|saniti|paper towel|chemicals?)/ },
    { id: "equipment", re: /(vacuum|machine|equipment|tool|drill|pressure washer|repair|replacement part)/ },
    { id: "marketing", re: /(meta|facebook|instagram|google ads|canva|flyer|ad spend|mailchimp|sms campaign)/ },
    { id: "software", re: /(subscription|xero|notion|slack|chatgpt|openai|vercel|supabase|domain|hosting|software|app|license)/ },
    { id: "insurance", re: /(insurance|aami|suncorp|nrma|policy|premium)/ },
    { id: "utilities", re: /(electric|energy|internet|telstra|optus|origin|agl|water|utility)/ },
    { id: "wages", re: /(payroll|wages|salary|super|contractor|employee|staff)/ },
    { id: "rent", re: /(rent|storage|warehouse|lease|unit)/ },
  ];
  for (const rule of rules) {
    if (rule.re.test(haystack)) return rule.id;
  }
  return "uncategorized";
}

function parseMoneyToken(token) {
  const raw = String(token || "").trim();
  if (!raw) return 0;
  let cleaned = raw.replace(/[^\d.,-]/g, "");
  if (!cleaned || cleaned === "." || cleaned === ",") return 0;

  const dotCount = (cleaned.match(/\./g) || []).length;
  const commaCount = (cleaned.match(/,/g) || []).length;

  if (commaCount > 0 && dotCount > 0) {
    cleaned = cleaned.replace(/,/g, "");
  } else if (commaCount > 0 && dotCount === 0) {
    const decimalLike = /,\d{2}$/.test(cleaned);
    cleaned = decimalLike ? cleaned.replace(",", ".") : cleaned.replace(/,/g, "");
  }

  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) return 0;
  return Math.round(value * 100) / 100;
}

function extractAmountFromText(text) {
  const raw = String(text || "");
  if (!raw.trim()) return 0;

  const lines = raw.split(/\r?\n+/).map((line) => line.trim()).filter(Boolean);
  const moneyPattern = /\$?\s*\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})|\$?\s*\d{1,6}/g;
  const ranked = [];

  for (const line of lines) {
    const tokens = line.match(moneyPattern) || [];
    if (!tokens.length) continue;
    const normalizedLine = line.toLowerCase();

    for (const token of tokens) {
      const amount = parseMoneyToken(token);
      if (!amount) continue;
      let score = 0;
      if (/\$/.test(token)) score += 12;
      if (/\d+[.,]\d{2}$/.test(token.trim())) score += 6;
      if (/(grand\s*total|total\s*due|amount\s*due|balance\s*due|to\s*pay|total|payment|card|eftpos|visa|mastercard|debit)/i.test(normalizedLine)) score += 80;
      if (/(subtotal|sub-total)/i.test(normalizedLine)) score += 20;
      if (/(gst|tax|vat|change|cash\s*tendered|discount|saving|qty|item|unit\s*price|price\s*per|abn|invoice\s*no|order\s*no|receipt\s*no|phone|fax)/i.test(normalizedLine)) score -= 35;
      if (amount <= 1) score -= 20;
      ranked.push({ amount, score, line: normalizedLine });
    }
  }

  if (ranked.length > 0) {
    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.amount - a.amount;
    });
    const best = ranked[0];
    if (best.score >= 0) return best.amount;

    const maxFallback = ranked.reduce((max, row) => Math.max(max, row.amount), 0);
    if (maxFallback > 0) return maxFallback;
  }

  const withDecimals = raw.match(/\$?\s*\d{1,4}(?:,\d{3})*(?:\.\d{2})/g) || [];
  for (const candidate of withDecimals) {
    const value = parseMoneyToken(candidate);
    if (value > 0) return value;
  }
  return 0;
}

function toIsoDate(value, fallback = new Date().toISOString().split("T")[0]) {
  const input = String(value || "").trim();
  if (!input) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const slash = input.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const yearRaw = Number(slash[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString().split("T")[0];
}

function detectVendor(prompt, fileName = "") {
  const haystack = `${prompt || ""} ${fileName || ""}`.toLowerCase();
  const known = [
    "Bunnings",
    "Woolworths",
    "Coles",
    "Aldi",
    "IGA",
    "BP",
    "Caltex",
    "Shell",
    "Officeworks",
    "Supercheap Auto",
    "Telstra",
    "Optus",
    "AGL",
    "Origin",
    "Xero",
    "Canva",
    "Meta",
    "Google Ads",
  ];
  for (const vendor of known) {
    if (haystack.includes(vendor.toLowerCase())) return vendor;
  }

  const candidate = String(prompt || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => line && line.length <= 70);
  if (!candidate) return "";
  return candidate
    .replace(/^vendor\s*:\s*/i, "")
    .replace(/^supplier\s*:\s*/i, "")
    .slice(0, 80)
    .trim();
}

function buildFallbackExpenseAnalysis({ prompt, fileName }) {
  const todayIso = new Date().toISOString().split("T")[0];
  const text = `${prompt || ""}\n${fileName || ""}`.trim();
  const amount = extractAmountFromText(text);
  const category = detectExpenseCategory(text);
  const vendor = detectVendor(prompt, fileName);
  const expenseDate = toIsoDate(text, todayIso);
  const gstClaimable = !/(gst\s*free|tax\s*free|no\s*gst)/i.test(text);
  const gstAmount = gstClaimable && amount > 0 ? Math.round((amount / 11) * 100) / 100 : 0;

  let confidence = 0.55;
  if (category !== "uncategorized") confidence += 0.12;
  if (amount > 0) confidence += 0.1;
  if (vendor) confidence += 0.08;
  if (expenseDate !== todayIso) confidence += 0.05;

  return {
    vendor,
    amount,
    expense_date: expenseDate,
    category,
    confidence: Math.min(0.9, confidence),
    gst_claimable: gstClaimable,
    gst_amount: gstAmount,
    notes: "",
    reasoning: "Fallback rule-based classification used (keyword and amount/date extraction).",
  };
}

function normalizeExpenseAnalysisPayload(payload, fallback) {
  const base = fallback || buildFallbackExpenseAnalysis({ prompt: "", fileName: "" });
  const amountCandidate = Number(payload?.amount);
  const amount = Number.isFinite(amountCandidate) && amountCandidate >= 0 ? Math.round(amountCandidate * 100) / 100 : base.amount;
  const gstClaimable = payload?.gst_claimable !== false;
  const gstInput = Number(payload?.gst_amount);
  const gstAmount = Number.isFinite(gstInput) && gstInput >= 0
    ? Math.round(gstInput * 100) / 100
    : (gstClaimable && amount > 0 ? Math.round((amount / 11) * 100) / 100 : 0);
  const confidenceInput = Number(payload?.confidence);
  const confidence = Number.isFinite(confidenceInput)
    ? Math.max(0, Math.min(1, confidenceInput))
    : Math.max(0, Math.min(1, Number(base.confidence || 0.55)));

  return {
    vendor: toStringValue(payload?.vendor, base.vendor),
    amount,
    expense_date: toIsoDate(payload?.expense_date, base.expense_date),
    category: normalizeExpenseCategory(payload?.category || base.category),
    confidence,
    gst_claimable: gstClaimable,
    gst_amount: gstAmount,
    notes: toStringValue(payload?.notes, base.notes || ""),
    reasoning: toStringValue(payload?.reasoning, base.reasoning || ""),
  };
}

async function generateExpenseAnalysis({ prompt, fileName, references, apiKey }) {
  const fallback = buildFallbackExpenseAnalysis({ prompt, fileName });
  const userContent = [
    {
      type: "text",
      text: [
        `Expense details: ${prompt || "N/A"}`,
        `Receipt file name: ${fileName || "N/A"}`,
        "Extract best-effort values and return strict JSON only.",
        "If receipt images are provided, prioritize OCR from the images over free-text assumptions.",
      ].join("\n"),
    },
  ];

  for (const dataUrl of references || []) {
    userContent.push({
      type: "image_url",
      image_url: { url: dataUrl },
    });
  }

  const completion = await callOpenAiJson("/chat/completions", {
    model: TEXT_MODEL,
    temperature: 0.15,
    messages: [
      {
        role: "system",
        content: [
          "You extract structured bookkeeping data from business expense notes and receipt images.",
          "Use visual OCR signals (vendor headers, totals, dates, GST lines) when present.",
          "When multiple totals appear, prefer the final payable amount.",
          "Do not hallucinate values; use conservative defaults if unclear.",
          "Return strict JSON only with keys:",
          "vendor, amount, expense_date, category, confidence, gst_claimable, gst_amount, notes, reasoning.",
          "category must be one of: supplies, travel, equipment, marketing, software, insurance, utilities, wages, rent, other, uncategorized.",
          "expense_date must be YYYY-MM-DD.",
          "confidence must be between 0 and 1.",
          "If uncertain, keep values conservative and explain reasoning briefly.",
        ].join(" "),
      },
      {
        role: "user",
        content: userContent,
      },
    ],
  }, apiKey);

  const raw = completion?.choices?.[0]?.message?.content || "";
  const parsed = JSON.parse(cleanJsonText(raw));
  const normalized = normalizeExpenseAnalysisPayload(parsed, fallback);

  if ((Number(normalized.amount || 0) <= 0.01) && Array.isArray(references) && references.length > 0) {
    try {
      const amountOnly = await callOpenAiJson("/chat/completions", {
        model: TEXT_MODEL,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: [
              "You read receipts and return strict JSON only.",
              "Return keys: amount, confidence, reasoning.",
              "amount must be the final payable total in AUD (number).",
              "If uncertain return amount 0 and low confidence.",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the final payable total from this receipt image." },
              ...references.map((dataUrl) => ({ type: "image_url", image_url: { url: dataUrl } })),
            ],
          },
        ],
      }, apiKey);

      const amountRaw = amountOnly?.choices?.[0]?.message?.content || "";
      const amountJson = JSON.parse(cleanJsonText(amountRaw));
      const extractedAmount = Number(amountJson?.amount);
      if (Number.isFinite(extractedAmount) && extractedAmount > 0) {
        normalized.amount = Math.round(extractedAmount * 100) / 100;
        if (normalized.gst_claimable !== false) {
          normalized.gst_amount = Math.round((normalized.amount / 11) * 100) / 100;
        }
        const confidenceBoost = Math.max(0, Math.min(1, Number(amountJson?.confidence || 0.5)));
        normalized.confidence = Math.max(normalized.confidence || 0.55, confidenceBoost);
        const reason = toStringValue(amountJson?.reasoning, "");
        normalized.reasoning = reason || normalized.reasoning || "Amount extracted from receipt total line.";
      }
    } catch (amountErr) {
      console.error("[api/marketing/generate] amount-only retry failed", amountErr?.message || amountErr);
    }
  }

  return normalized;
}

async function callOpenAiJson(endpoint, payload, apiKey) {
  const res = await fetch(`${OPENAI_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let body = {};
  try { body = JSON.parse(text); } catch {}

  if (!res.ok) {
    const err = body?.error?.message || text || `OpenAI request failed (${res.status})`;
    throw new Error(err);
  }

  return body;
}

async function generateMarketingCopy({ prompt, channel, platform, references, apiKey }) {
  const userContent = [
    {
      type: "text",
      text: [
        `User prompt: ${prompt}`,
        `Channel: ${channel}`,
        `Platform: ${platform}`,
        "Audience: homeowners on the Sunshine Coast, Australia.",
        "Brand tone: earthy, trustworthy, premium but approachable.",
      ].join("\n"),
    },
  ];

  for (const dataUrl of references) {
    userContent.push({
      type: "image_url",
      image_url: { url: dataUrl },
    });
  }

  const completion = await callOpenAiJson("/chat/completions", {
    model: TEXT_MODEL,
    temperature: 0.8,
    messages: [
      {
        role: "system",
        content: [
          "You create high-converting local marketing copy for cleaning businesses.",
          "Return strict JSON only with keys:",
          "headline, subheadline, cta, caption, hashtags (array), email_subject, email_body, poster_prompt.",
          "Keep copy concise, sales-oriented, and realistic.",
        ].join(" "),
      },
      {
        role: "user",
        content: userContent,
      },
    ],
  }, apiKey);

  const raw = completion?.choices?.[0]?.message?.content || "";
  const parsed = JSON.parse(cleanJsonText(raw));
  return normalizeCopyPayload(parsed, { prompt, channel, platform });
}

async function generateMarketingImage({ copy, channel, platform, apiKey }) {
  const platformInfo = PLATFORM_META[platform] || PLATFORM_META.instagram;
  const imagePrompt = [
    copy.posterPrompt,
    `Use this headline: "${copy.headline}"`,
    `Use this supporting line: "${copy.subheadline}"`,
    `Use this CTA: "${copy.cta}"`,
    `Layout target: ${platformInfo.label}.`,
    "Style: clean poster design, earthy tones, readable typography, professional social-media ad.",
    `Business name must appear as "Dust Bunnies Cleaning".`,
    channel === "email" ? "Design suitable for email campaign visual." : "Design suitable for social post.",
    "Do not include QR codes or fake phone numbers.",
  ].join("\n");

  const imageRes = await callOpenAiJson("/images/generations", {
    model: IMAGE_MODEL,
    prompt: imagePrompt,
    size: platformInfo.size,
  }, apiKey);

  const b64 = imageRes?.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image API returned no image payload.");
  return {
    imageDataUrl: `data:image/png;base64,${b64}`,
    imageSize: platformInfo.size,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed." });

  try {
    runApiSecurity(req, { rateLimitKey: "marketing:generate", max: 24, windowMs: 10 * 60_000 });
    const openAiApiKey = getOpenAiApiKey();

    let admin;
    try {
      admin = getAdminClient();
    } catch (envErr) {
      throw new ApiError(500, envErr.message || "Server environment is misconfigured.");
    }

    const body = await parseJsonBody(req);
    const task = toStringValue(body?.task, "marketing_generate").toLowerCase();
    const references = sanitizeReferences(body?.references);

    if (task === "expense_analyze") {
      const { user } = await requireProfile(req, admin, { roles: ["admin", "finance"], requireActive: true });
      const prompt = toStringValue(body?.prompt, "");
      const fileName = toStringValue(body?.fileName, "");
      if (!prompt && !fileName && references.length === 0) {
        throw new ApiError(400, "Provide expense details or a receipt image.");
      }

      let result;
      let warning = null;

      if (!openAiApiKey) {
        result = buildFallbackExpenseAnalysis({ prompt, fileName });
        warning = "OpenAI API key is missing. Used built-in analysis mode.";
      } else {
        try {
          result = await generateExpenseAnalysis({ prompt, fileName, references, apiKey: openAiApiKey });
        } catch (analysisErr) {
          console.error("[api/marketing/generate] expense analysis failed", {
            userId: user.id,
            error: analysisErr?.message || analysisErr,
          });
          result = buildFallbackExpenseAnalysis({ prompt, fileName });
          warning = "AI analysis failed. Used built-in analysis mode.";
        }
      }

      return sendJson(res, 200, {
        ok: true,
        warning,
        result,
      });
    }

    if (!["marketing_generate", "marketing"].includes(task)) {
      throw new ApiError(400, "Invalid task. Use 'marketing_generate' or 'expense_analyze'.");
    }

    const { user } = await requireAdmin(req, admin);
    const prompt = toStringValue(body?.prompt);
    const channel = toStringValue(body?.channel, "social").toLowerCase();
    const platform = toStringValue(body?.platform, channel === "email" ? "email" : "instagram").toLowerCase();

    if (!prompt || prompt.length < 8) {
      throw new ApiError(400, "Prompt is required (min 8 characters).");
    }
    if (!["social", "email"].includes(channel)) {
      throw new ApiError(400, "channel must be 'social' or 'email'.");
    }
    if (!PLATFORM_META[platform]) {
      throw new ApiError(400, "Invalid platform. Use instagram, facebook, or email.");
    }

    let copy;
    let imageDataUrl = "";
    let imageSize = PLATFORM_META[platform].size;
    let warning = null;

    if (!openAiApiKey) {
      copy = buildFallbackCopy({ prompt, channel, platform });
      imageDataUrl = fallbackPosterDataUrl(copy);
      warning = "OpenAI API key is missing. Generated in built-in template mode.";
    } else {
      try {
        copy = await generateMarketingCopy({ prompt, channel, platform, references, apiKey: openAiApiKey });
      } catch (copyErr) {
        console.error("[api/marketing/generate] copy generation failed", {
          userId: user.id,
          platform,
          error: copyErr?.message || copyErr,
        });
        copy = buildFallbackCopy({ prompt, channel, platform });
        warning = "AI copy generation failed. Using built-in template mode.";
      }

      try {
        const image = await generateMarketingImage({ copy, channel, platform, apiKey: openAiApiKey });
        imageDataUrl = image.imageDataUrl;
        imageSize = image.imageSize;
      } catch (imageErr) {
        if (!warning) warning = "Copy generated, but image generation failed. Using fallback poster.";
        imageDataUrl = fallbackPosterDataUrl(copy);
        console.error("[api/marketing/generate] image generation failed", {
          userId: user.id,
          platform,
          error: imageErr?.message || imageErr,
        });
      }
    }

    return sendJson(res, 200, {
      ok: true,
      warning,
      result: {
        ...copy,
        imageDataUrl,
        imageSize,
      },
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof ApiError ? error.message : "Internal server error.";
    const details = error instanceof ApiError ? error.details : null;
    console.error("[api/marketing/generate] request failed", error);
    return sendJson(res, status, { error: message, details });
  }
}
