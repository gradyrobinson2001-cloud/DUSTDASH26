import { getAdminClient } from "../_lib/supabaseAdmin.js";
import { requireAdmin } from "../_lib/auth.js";
import { ApiError, parseJsonBody, sendJson } from "../_lib/http.js";
import { runApiSecurity } from "../_lib/security.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const TEXT_MODEL = process.env.AI_MARKETING_TEXT_MODEL || "gpt-4.1-mini";
const IMAGE_MODEL = process.env.AI_MARKETING_IMAGE_MODEL || "gpt-image-1";

const PLATFORM_META = {
  instagram: { size: "1024x1024", label: "Instagram Post" },
  facebook: { size: "1536x1024", label: "Facebook Feed" },
  email: { size: "1536x1024", label: "Email Banner" },
};

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

async function callOpenAiJson(endpoint, payload) {
  const res = await fetch(`${OPENAI_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
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

async function generateMarketingCopy({ prompt, channel, platform, references }) {
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
  });

  const raw = completion?.choices?.[0]?.message?.content || "";
  const parsed = JSON.parse(cleanJsonText(raw));
  return normalizeCopyPayload(parsed, { prompt, channel, platform });
}

async function generateMarketingImage({ copy, channel, platform }) {
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
  });

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

    if (!OPENAI_API_KEY) {
      throw new ApiError(500, "Server env missing: OPENAI_API_KEY.");
    }

    let admin;
    try {
      admin = getAdminClient();
    } catch (envErr) {
      throw new ApiError(500, envErr.message || "Server environment is misconfigured.");
    }

    const { user } = await requireAdmin(req, admin);
    const body = await parseJsonBody(req);
    const prompt = toStringValue(body?.prompt);
    const channel = toStringValue(body?.channel, "social").toLowerCase();
    const platform = toStringValue(body?.platform, channel === "email" ? "email" : "instagram").toLowerCase();
    const references = sanitizeReferences(body?.references);

    if (!prompt || prompt.length < 8) {
      throw new ApiError(400, "Prompt is required (min 8 characters).");
    }
    if (!["social", "email"].includes(channel)) {
      throw new ApiError(400, "channel must be 'social' or 'email'.");
    }
    if (!PLATFORM_META[platform]) {
      throw new ApiError(400, "Invalid platform. Use instagram, facebook, or email.");
    }

    const copy = await generateMarketingCopy({ prompt, channel, platform, references });
    let imageDataUrl = "";
    let imageSize = PLATFORM_META[platform].size;
    let warning = null;
    try {
      const image = await generateMarketingImage({ copy, channel, platform });
      imageDataUrl = image.imageDataUrl;
      imageSize = image.imageSize;
    } catch (imageErr) {
      warning = "Copy generated, but image generation failed.";
      console.error("[api/marketing/generate] image generation failed", {
        userId: user.id,
        platform,
        error: imageErr?.message || imageErr,
      });
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
