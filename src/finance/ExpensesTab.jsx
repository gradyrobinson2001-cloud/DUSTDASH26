import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, supabaseReady } from "../lib/supabase";
import { T } from "../shared";

const CATEGORY_OPTIONS = [
  { id: "supplies", label: "Cleaning Supplies", color: "#6EA97D" },
  { id: "travel", label: "Fuel & Travel", color: "#4F7D82" },
  { id: "equipment", label: "Equipment & Tools", color: "#C08B52" },
  { id: "marketing", label: "Marketing & Ads", color: "#8D6CB4" },
  { id: "software", label: "Software & Subscriptions", color: "#6D7FB1" },
  { id: "insurance", label: "Insurance", color: "#A77C7C" },
  { id: "utilities", label: "Utilities", color: "#85756B" },
  { id: "wages", label: "Wages & Contractors", color: "#C56058" },
  { id: "rent", label: "Rent & Storage", color: "#5A856A" },
  { id: "other", label: "Other", color: "#86939B" },
  { id: "uncategorized", label: "Uncategorized", color: "#98A89D" },
];

const PAYMENT_METHODS = ["bank", "card", "cash", "direct_debit", "other"];
const STATUS_OPTIONS = ["needs_review", "approved"];

const formatAud = (value) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const toDateInputValue = (value) => {
  const raw = String(value || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().split("T")[0];
  return date.toISOString().split("T")[0];
};

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function monthKey(dateLike) {
  const d = new Date(dateLike || Date.now());
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(dateLike) {
  const d = new Date(dateLike || Date.now());
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString("en-AU", { month: "short", year: "numeric" });
}

function categoryMeta(id) {
  return CATEGORY_OPTIONS.find((cat) => cat.id === id) || CATEGORY_OPTIONS.find((cat) => cat.id === "uncategorized");
}

function guessCategory(vendor, notes, fileName) {
  const text = `${vendor || ""} ${notes || ""} ${fileName || ""}`.toLowerCase();
  const rules = [
    { id: "travel", re: /(bp|caltex|shell|fuel|petrol|diesel|uber|toll|parking|rego|mechanic|tyre|service)/ },
    { id: "supplies", re: /(bunnings|woolworths|coles|aldi|iga|clean|detergent|bleach|microfibre|mop|vacuum bags|sanit)/ },
    { id: "equipment", re: /(vacuum|machine|equipment|tool|drill|pressure washer|repair)/ },
    { id: "marketing", re: /(meta|facebook|instagram|google ads|canva|flyer|ad spend|mailchimp|sms)/ },
    { id: "software", re: /(subscription|xero|notion|slack|chatgpt|openai|vercel|supabase|domain|hosting|software|app)/ },
    { id: "insurance", re: /(insurance|aami|suncorp|nrma|policy|premium)/ },
    { id: "utilities", re: /(electric|energy|internet|telstra|optus|origin|agl|water|utility)/ },
    { id: "wages", re: /(payroll|wages|salary|super|contractor|employee|staff)/ },
    { id: "rent", re: /(rent|storage|warehouse|lease|unit)/ },
  ];

  for (const rule of rules) {
    if (rule.re.test(text)) return rule.id;
  }
  return "uncategorized";
}

function estimateGst(amount, gstClaimable, text = "") {
  const normalizedAmount = Math.max(0, toNumber(amount, 0));
  if (!gstClaimable || normalizedAmount <= 0) return 0;
  const taxFreeMatch = /(gst\s*free|tax\s*free|no\s*gst)/i.test(String(text || ""));
  if (taxFreeMatch) return 0;
  return Math.round((normalizedAmount / 11) * 100) / 100;
}

function extractLikelyAmountLocal(text) {
  const raw = String(text || "");
  if (!raw.trim()) return 0;
  const lines = raw.split(/\r?\n+/).map((line) => line.trim()).filter(Boolean);
  const moneyPattern = /\$?\s*\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})|\$?\s*\d{1,6}/g;
  const ranked = [];

  for (const line of lines) {
    const tokens = line.match(moneyPattern) || [];
    if (!tokens.length) continue;
    const normalized = line.toLowerCase();
    for (const token of tokens) {
      const amount = Number(String(token).replace(/[^\d.]/g, ""));
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) continue;
      let score = 0;
      if (/\$/.test(token)) score += 10;
      if (/(grand\s*total|total\s*due|amount\s*due|to\s*pay|total|payment|card)/i.test(normalized)) score += 60;
      if (/(gst|tax|change|discount|qty|item|order|receipt\s*no|invoice\s*no)/i.test(normalized)) score -= 20;
      ranked.push({ amount: Math.round(amount * 100) / 100, score });
    }
  }

  if (!ranked.length) return 0;
  ranked.sort((a, b) => (b.score - a.score) || (b.amount - a.amount));
  return ranked[0].amount || 0;
}

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read receipt image."));
    reader.readAsDataURL(file);
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode receipt image."));
    image.src = url;
  });
}

async function optimizeReceipt(file) {
  const original = await toDataUrl(file);
  const image = await loadImage(original);
  const maxSide = 1280;
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

async function buildReceiptVariants(file) {
  const optimized = await optimizeReceipt(file);
  let ocrVariant = "";
  let boostedVariant = "";
  try {
    const image = await loadImage(optimized);
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.filter = "grayscale(1) contrast(1.45) brightness(1.12)";
      ctx.drawImage(image, 0, 0);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = frame.data;
      for (let i = 0; i < px.length; i += 4) {
        const avg = (px[i] + px[i + 1] + px[i + 2]) / 3;
        const v = avg > 168 ? 255 : 0;
        px[i] = v;
        px[i + 1] = v;
        px[i + 2] = v;
      }
      ctx.putImageData(frame, 0, 0);
      ocrVariant = canvas.toDataURL("image/jpeg", 0.9);

      const boostCanvas = document.createElement("canvas");
      const boostScale = 1.35;
      boostCanvas.width = Math.max(1, Math.round(image.width * boostScale));
      boostCanvas.height = Math.max(1, Math.round(image.height * boostScale));
      const boostCtx = boostCanvas.getContext("2d");
      if (boostCtx) {
        boostCtx.imageSmoothingEnabled = true;
        boostCtx.imageSmoothingQuality = "high";
        boostCtx.filter = "grayscale(1) contrast(1.7) brightness(1.2)";
        boostCtx.drawImage(image, 0, 0, boostCanvas.width, boostCanvas.height);
        boostedVariant = boostCanvas.toDataURL("image/jpeg", 0.92);
      }
    }
  } catch {
    ocrVariant = "";
    boostedVariant = "";
  }
  return { optimized, ocrVariant, boostedVariant };
}

function normalizeAiExpenseResult(payload, fallback) {
  if (!payload || typeof payload !== "object") return fallback;
  const inferredAmount = extractLikelyAmountLocal(`${payload?.reasoning || ""}\n${payload?.notes || ""}\n${fallback?.notes || ""}`);
  const amount = Math.max(0, toNumber(payload.amount, fallback.amount || inferredAmount));
  const gstClaimable = payload.gst_claimable !== false;
  const category = String(payload.category || fallback.category || "uncategorized").trim().toLowerCase();
  const validCategory = CATEGORY_OPTIONS.some((row) => row.id === category) ? category : fallback.category;
  const confidence = Math.max(0, Math.min(1, toNumber(payload.confidence, 0.55)));

  return {
    ...fallback,
    vendor: String(payload.vendor || fallback.vendor || "").trim(),
    amount,
    expense_date: toDateInputValue(payload.expense_date || fallback.expense_date),
    category: validCategory || "uncategorized",
    ai_suggested_category: validCategory || "uncategorized",
    ai_confidence: confidence,
    ai_reasoning: String(payload.reasoning || payload.notes || fallback.ai_reasoning || ""),
    gst_claimable: gstClaimable,
    gst_amount: Math.max(0, toNumber(payload.gst_amount, estimateGst(amount, gstClaimable, payload.reasoning || payload.notes))),
    notes: String(payload.notes || fallback.notes || ""),
  };
}

function initialFormState() {
  const today = new Date().toISOString().split("T")[0];
  return {
    expense_date: today,
    vendor: "",
    amount: "",
    category: "uncategorized",
    gst_claimable: true,
    gst_amount: "",
    payment_method: "card",
    notes: "",
    receipt_data_url: "",
    receipt_ocr_data_url: "",
    receipt_file_name: "",
    ai_suggested_category: "",
    ai_confidence: 0,
    ai_reasoning: "",
    status: "needs_review",
    is_recurring: false,
  };
}

export default function ExpensesTab({
  expenses,
  budgets,
  addExpense,
  updateExpense,
  removeExpense,
  upsertBudget,
  removeBudget,
  loadError,
  showToast,
  isMobile,
}) {
  const [form, setForm] = useState(initialFormState);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [budgetMonth, setBudgetMonth] = useState(() => monthKey(new Date()));
  const [budgetDrafts, setBudgetDrafts] = useState({});
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [showAdvancedForm, setShowAdvancedForm] = useState(false);
  const [analysisWarning, setAnalysisWarning] = useState("");
  const receiptInputRef = useRef(null);

  const months = useMemo(() => {
    const unique = new Set((expenses || []).map((row) => monthKey(row.expense_date)));
    return Array.from(unique).sort().reverse();
  }, [expenses]);

  const budgetMonthOptions = useMemo(() => {
    const keys = new Set(months);
    for (const row of budgets || []) {
      keys.add(monthKey(`${row.month_key || ""}-01`));
    }
    keys.add(monthKey(new Date()));
    return Array.from(keys).sort().reverse().slice(0, 12);
  }, [budgets, months]);

  const budgetsForMonth = useMemo(() => {
    return (budgets || []).filter((row) => String(row.month_key || "") === budgetMonth);
  }, [budgetMonth, budgets]);

  const budgetByCategory = useMemo(() => {
    return budgetsForMonth.reduce((acc, row) => {
      const key = String(row.category || "all");
      acc[key] = row;
      return acc;
    }, {});
  }, [budgetsForMonth]);

  const monthSpendByCategory = useMemo(() => {
    const out = {};
    for (const row of expenses || []) {
      if (monthKey(row.expense_date) !== budgetMonth) continue;
      const key = String(row.category || "uncategorized");
      out[key] = (out[key] || 0) + Number(row.amount || 0);
      out.all = (out.all || 0) + Number(row.amount || 0);
    }
    return out;
  }, [budgetMonth, expenses]);

  const budgetRows = useMemo(() => {
    const keys = ["all", ...CATEGORY_OPTIONS.map((row) => row.id)];
    return keys.map((key) => {
      const spent = Number(monthSpendByCategory[key] || 0);
      const budget = Number(budgetByCategory[key]?.budget_amount || 0);
      const ratio = budget > 0 ? spent / budget : 0;
      return {
        key,
        label: key === "all" ? "Total Monthly Budget" : categoryMeta(key)?.label || key,
        spent,
        budget,
        ratio,
        budgetId: budgetByCategory[key]?.id || null,
      };
    });
  }, [budgetByCategory, monthSpendByCategory]);

  const budgetEditorRows = useMemo(() => {
    const focus = new Set(["all", "supplies", "travel", "equipment", "marketing", "software", "utilities"]);
    return budgetRows.filter((row) => focus.has(row.key) || row.budget > 0 || row.spent > 0);
  }, [budgetRows]);

  const budgetAlertCount = useMemo(() => (
    budgetRows.filter((row) => row.budget > 0 && row.ratio >= 0.85).length
  ), [budgetRows]);

  const summary = useMemo(() => {
    const list = Array.isArray(expenses) ? expenses : [];
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthRows = list.filter((row) => monthKey(row.expense_date) === thisMonth);
    const monthSpend = monthRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const gstClaimable = monthRows
      .filter((row) => row.gst_claimable)
      .reduce((sum, row) => sum + Number(row.gst_amount || 0), 0);
    const needsReview = list.filter((row) => row.status !== "approved" || Number(row.ai_confidence || 0) < 0.62).length;
    const recurringVendorCount = Object.values(
      list.reduce((acc, row) => {
        const key = String(row.vendor || "").trim().toLowerCase();
        if (!key) return acc;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    ).filter((count) => count >= 3).length;

    const duplicateCandidates = new Set();
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        if (!a || !b) continue;
        const sameAmount = Math.abs(Number(a.amount || 0) - Number(b.amount || 0)) < 0.01;
        const sameDate = String(a.expense_date || "") === String(b.expense_date || "");
        const sameVendor = String(a.vendor || "").trim().toLowerCase() === String(b.vendor || "").trim().toLowerCase();
        if (sameAmount && sameDate && sameVendor && sameVendor) {
          duplicateCandidates.add(String(a.id));
          duplicateCandidates.add(String(b.id));
        }
      }
    }

    return {
      monthSpend,
      gstClaimable,
      needsReview,
      recurringVendorCount,
      duplicateCount: duplicateCandidates.size,
    };
  }, [expenses]);

  const monthlySeries = useMemo(() => {
    const map = {};
    for (const row of expenses || []) {
      const key = monthKey(row.expense_date);
      if (!map[key]) map[key] = { key, label: monthLabel(`${key}-01`), amount: 0 };
      map[key].amount += Number(row.amount || 0);
    }
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key)).slice(-6);
  }, [expenses]);

  const categorySeries = useMemo(() => {
    const totals = {};
    for (const row of expenses || []) {
      const key = String(row.category || "uncategorized");
      totals[key] = (totals[key] || 0) + Number(row.amount || 0);
    }
    return Object.entries(totals)
      .map(([category, amount]) => ({
        category,
        amount,
        meta: categoryMeta(category),
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const topVendors = useMemo(() => {
    const map = {};
    for (const row of expenses || []) {
      const vendor = String(row.vendor || "").trim();
      if (!vendor) continue;
      if (!map[vendor]) map[vendor] = { vendor, amount: 0, count: 0 };
      map[vendor].amount += Number(row.amount || 0);
      map[vendor].count += 1;
    }
    return Object.values(map).sort((a, b) => b.amount - a.amount).slice(0, 6);
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    return (expenses || [])
      .filter((row) => {
        if (filterCategory !== "all" && String(row.category || "") !== filterCategory) return false;
        if (filterStatus !== "all" && String(row.status || "") !== filterStatus) return false;
        if (filterMonth !== "all" && monthKey(row.expense_date) !== filterMonth) return false;
        if (!search.trim()) return true;
        const needle = search.trim().toLowerCase();
        const haystack = `${row.vendor || ""} ${row.notes || ""} ${row.category || ""} ${row.payment_method || ""}`.toLowerCase();
        return haystack.includes(needle);
      })
      .sort((a, b) => `${b.expense_date || ""} ${b.created_at || ""}`.localeCompare(`${a.expense_date || ""} ${a.created_at || ""}`));
  }, [expenses, filterCategory, filterMonth, filterStatus, search]);

  const reviewQueue = useMemo(() => {
    return (expenses || [])
      .filter((row) => row.status !== "approved" || Number(row.ai_confidence || 0) < 0.62)
      .sort((a, b) => Number(a.ai_confidence || 0) - Number(b.ai_confidence || 0));
  }, [expenses]);

  const anomalies = useMemo(() => {
    const list = Array.isArray(expenses) ? expenses : [];
    const out = [];
    const seen = new Set();

    const byVendorAmountDate = {};
    for (const row of list) {
      const key = [
        String(row.vendor || "").trim().toLowerCase(),
        String(row.expense_date || ""),
        Number(row.amount || 0).toFixed(2),
      ].join("|");
      if (!byVendorAmountDate[key]) byVendorAmountDate[key] = [];
      byVendorAmountDate[key].push(row);
    }
    Object.values(byVendorAmountDate).forEach((group) => {
      if (group.length <= 1) return;
      group.forEach((row) => {
        const id = `dup-${row.id}`;
        if (seen.has(id)) return;
        seen.add(id);
        out.push({
          id,
          type: "duplicate",
          severity: "high",
          row,
          message: "Possible duplicate expense (same vendor, date, and amount).",
        });
      });
    });

    const vendorHistory = {};
    for (const row of list) {
      const vendor = String(row.vendor || "").trim().toLowerCase();
      if (!vendor) continue;
      if (!vendorHistory[vendor]) vendorHistory[vendor] = [];
      vendorHistory[vendor].push(row);
    }
    Object.values(vendorHistory).forEach((rows) => {
      if (rows.length < 3) return;
      const avg = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0) / rows.length;
      rows.forEach((row) => {
        const amount = Number(row.amount || 0);
        if (avg > 0 && amount > avg * 1.9 && amount - avg >= 80) {
          const id = `spike-${row.id}`;
          if (seen.has(id)) return;
          seen.add(id);
          out.push({
            id,
            type: "spike",
            severity: "medium",
            row,
            message: `Spend spike for vendor (${formatAud(amount)} vs avg ${formatAud(avg)}).`,
          });
        }
      });
    });

    list.forEach((row) => {
      const amount = Number(row.amount || 0);
      const confidence = Number(row.ai_confidence || 0);
      if (amount >= 250 && !row.receipt_data_url) {
        const id = `receipt-${row.id}`;
        if (!seen.has(id)) {
          seen.add(id);
          out.push({
            id,
            type: "missing_receipt",
            severity: "medium",
            row,
            message: "High-value expense without receipt attachment.",
          });
        }
      }
      if (amount >= 200 && confidence < 0.55) {
        const id = `low-confidence-${row.id}`;
        if (!seen.has(id)) {
          seen.add(id);
          out.push({
            id,
            type: "low_confidence",
            severity: "low",
            row,
            message: "High-value expense with low AI confidence.",
          });
        }
      }
    });

    budgetRows.forEach((row) => {
      if (row.budget <= 0 || row.ratio < 1) return;
      const id = `budget-${row.key}`;
      if (seen.has(id)) return;
      seen.add(id);
      out.push({
        id,
        type: "budget_overrun",
        severity: "high",
        row: null,
        message: `${row.label} is over budget (${formatAud(row.spent)} / ${formatAud(row.budget)}).`,
      });
    });

    const rank = { high: 0, medium: 1, low: 2 };
    return out.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9)).slice(0, 12);
  }, [budgetRows, expenses]);

  useEffect(() => {
    setBudgetDrafts({});
  }, [budgetMonth, budgets]);

  const handleSmartCategorizeLocal = useCallback(() => {
    const category = guessCategory(form.vendor, form.notes, form.receipt_file_name);
    const amount = Math.max(0, toNumber(form.amount, 0));
    const gstClaimable = form.gst_claimable !== false;
    const gstAmount = estimateGst(amount, gstClaimable, form.notes);
    setForm((prev) => ({
      ...prev,
      category,
      ai_suggested_category: category,
      ai_confidence: 0.66,
      ai_reasoning: "Applied rule-based categorization from vendor/notes keywords.",
      gst_amount: prev.gst_amount ? prev.gst_amount : String(gstAmount || ""),
    }));
    showToast("Applied smart categorization.");
  }, [form.amount, form.gst_claimable, form.notes, form.receipt_file_name, form.vendor, showToast]);

  const getAccessToken = async () => {
    if (!supabaseReady || !supabase) throw new Error("Supabase auth is not configured.");
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message || "Failed to load auth session.");
    const token = data?.session?.access_token;
    if (!token) throw new Error("Admin session required. Please sign in again.");
    return token;
  };

  const runAiExpenseAnalysis = useCallback(({
    promptOverride = "",
    referencesOverride = null,
    fileNameOverride = "",
    vendorOverride = null,
    amountOverride = null,
    dateOverride = null,
    notesOverride = null,
  } = {}) => {
    const references = Array.isArray(referencesOverride)
      ? referencesOverride.filter(Boolean)
      : [form.receipt_data_url, form.receipt_ocr_data_url].filter(Boolean);
    const resolvedFileName = fileNameOverride || form.receipt_file_name || "";
    const vendor = vendorOverride ?? form.vendor;
    const amount = amountOverride ?? form.amount;
    const expenseDate = dateOverride ?? form.expense_date;
    const notes = notesOverride ?? form.notes;
    const prompt = (promptOverride || [
      "Task: Extract bookkeeping fields from this expense/receipt.",
      "Priority: detect final payable total amount (not subtotal or GST line).",
      vendor ? `Known vendor hint: ${vendor}` : "Known vendor hint: unknown",
      amount ? `Known amount hint: ${amount}` : "Known amount hint: unknown",
      expenseDate ? `Known date hint: ${expenseDate}` : "",
      notes ? `Extra notes: ${notes}` : "",
      resolvedFileName ? `Receipt filename: ${resolvedFileName}` : "",
    ].filter(Boolean).join("\n")).trim();

    if (!prompt && references.length === 0) {
      showToast("Add details or upload a receipt first.");
      return;
    }

    setAnalyzing(true);
    return (async () => {
      const token = await getAccessToken();
      const res = await fetch("/api/marketing/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          task: "expense_analyze",
          prompt,
          fileName: resolvedFileName,
          references,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.error) {
        throw new Error(body?.error || body?.details || `Request failed (${res.status})`);
      }
      const fallback = {
        ...form,
        vendor: String(vendor || form.vendor || ""),
        amount: String(amount || form.amount || ""),
        expense_date: String(expenseDate || form.expense_date || ""),
        notes: String(notes || form.notes || ""),
        receipt_file_name: resolvedFileName || form.receipt_file_name || "",
        category: guessCategory(vendor || form.vendor, notes || form.notes, resolvedFileName || form.receipt_file_name),
      };
      const normalized = normalizeAiExpenseResult(body?.result, fallback);
      setForm((prev) => ({
        ...prev,
        ...normalized,
        amount: normalized.amount ? String(normalized.amount) : prev.amount,
        gst_amount: normalized.gst_amount ? String(normalized.gst_amount) : prev.gst_amount,
      }));
      setAnalysisWarning(String(body?.warning || "").trim());
      showToast(body?.warning ? `AI analysis complete (${body.warning})` : "AI analysis complete.");
    })().catch((err) => {
      console.error("[expenses:ai-analysis] failed", err);
      setAnalysisWarning("");
      showToast(`AI analysis failed: ${err.message}`);
      handleSmartCategorizeLocal();
    }).finally(() => {
      setAnalyzing(false);
    });
  }, [form, getAccessToken, handleSmartCategorizeLocal, showToast]);

  const onReceiptSelected = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      showToast("Please upload an image receipt.");
      event.target.value = "";
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast("Receipt image is too large. Keep it under 8MB.");
      event.target.value = "";
      return;
    }

    try {
      setAnalysisWarning("");
      const variants = await buildReceiptVariants(file);
      setForm((prev) => ({
        ...prev,
        receipt_data_url: variants.optimized,
        receipt_ocr_data_url: variants.boostedVariant || variants.ocrVariant,
        receipt_file_name: file.name || prev.receipt_file_name,
      }));
      showToast("Receipt uploaded. Running AI analysis...");
      await runAiExpenseAnalysis({
        promptOverride: [
          prevOrBlank(form.vendor, "Vendor unknown"),
          prevOrBlank(form.amount, "Amount unknown"),
          prevOrBlank(form.notes, "No extra notes"),
        ].join("\n"),
        referencesOverride: [variants.optimized, variants.ocrVariant, variants.boostedVariant].filter(Boolean),
        fileNameOverride: file.name || form.receipt_file_name,
        vendorOverride: form.vendor,
        amountOverride: form.amount,
        dateOverride: form.expense_date,
        notesOverride: form.notes,
      });
    } catch (err) {
      console.error("[expenses:receipt] upload failed", err);
      showToast(`Failed to process receipt: ${err.message}`);
    } finally {
      event.target.value = "";
    }
  };

  const onSaveExpense = async () => {
    const vendor = String(form.vendor || "").trim() || (form.receipt_file_name ? "Receipt Expense" : "");
    const amount = Math.max(0, toNumber(form.amount, 0));
    if (!vendor) {
      showToast("Add a vendor or upload a receipt first.");
      return;
    }
    if (!amount) {
      showToast("Amount must be greater than 0.");
      return;
    }

    const gstClaimable = form.gst_claimable !== false;
    const gstAmount = form.gst_amount !== ""
      ? Math.max(0, toNumber(form.gst_amount, 0))
      : estimateGst(amount, gstClaimable, form.notes);
    const category = form.category || guessCategory(form.vendor, form.notes, form.receipt_file_name);
    const confidence = Math.max(0, Math.min(1, toNumber(form.ai_confidence, 0)));
    const status = confidence >= 0.75 && form.status !== "needs_review" ? "approved" : form.status;

    setSaving(true);
    try {
      await addExpense({
        expense_date: toDateInputValue(form.expense_date),
        vendor,
        amount,
        gst_amount: gstAmount,
        gst_claimable: gstClaimable,
        category,
        status,
        payment_method: form.payment_method || "card",
        notes: form.notes || "",
        receipt_data_url: form.receipt_data_url || "",
        receipt_file_name: form.receipt_file_name || "",
        ai_suggested_category: form.ai_suggested_category || category,
        ai_confidence: confidence,
        ai_reasoning: form.ai_reasoning || "",
        is_recurring: Boolean(form.is_recurring),
      });
      showToast("Expense saved.");
      setForm(initialFormState());
      setAnalysisWarning("");
    } catch (err) {
      console.error("[expenses:save] failed", err);
      showToast(`Failed to save expense: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const changeRowCategory = useCallback(async (id, category) => {
    try {
      await updateExpense(id, { category, status: "needs_review" });
    } catch (err) {
      console.error("[expenses:row-category] failed", err);
      showToast(`Failed to update category: ${err.message}`);
    }
  }, [showToast, updateExpense]);

  const toggleRowApproval = useCallback(async (row) => {
    try {
      await updateExpense(row.id, { status: row.status === "approved" ? "needs_review" : "approved" });
    } catch (err) {
      console.error("[expenses:row-approve] failed", err);
      showToast(`Failed to update status: ${err.message}`);
    }
  }, [showToast, updateExpense]);

  const approveRow = useCallback(async (id) => {
    try {
      await updateExpense(id, { status: "approved" });
    } catch (err) {
      console.error("[expenses:row-approve-direct] failed", err);
      showToast(`Failed to approve expense: ${err.message}`);
    }
  }, [showToast, updateExpense]);

  const deleteRow = useCallback(async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await removeExpense(id);
      showToast("Expense deleted.");
    } catch (err) {
      console.error("[expenses:row-delete] failed", err);
      showToast(`Failed to delete expense: ${err.message}`);
    }
  }, [removeExpense, showToast]);

  const handleBudgetDraftChange = useCallback((category, value) => {
    setBudgetDrafts((prev) => ({ ...prev, [category]: value }));
  }, []);

  const saveBudgetTargets = useCallback(async () => {
    setBudgetSaving(true);
    try {
      const keys = Object.keys(budgetDrafts);
      for (const category of keys) {
        const parsed = Math.max(0, toNumber(budgetDrafts[category], 0));
        const existing = budgetByCategory[category];
        if (parsed <= 0) {
          if (existing?.id) await removeBudget(existing.id);
          continue;
        }
        await upsertBudget({
          month_key: budgetMonth,
          category,
          budget_amount: parsed,
        });
      }
      setBudgetDrafts({});
      showToast("Budget targets saved.");
    } catch (err) {
      console.error("[expenses:budget-save] failed", err);
      showToast(`Failed to save budget targets: ${err.message}`);
    } finally {
      setBudgetSaving(false);
    }
  }, [budgetByCategory, budgetDrafts, budgetMonth, removeBudget, showToast, upsertBudget]);

  const focusAnomalyExpense = useCallback((row) => {
    if (!row) return;
    setSearch(String(row.vendor || "").trim());
    setFilterMonth(monthKey(row.expense_date));
    setFilterCategory(String(row.category || "all"));
    showToast("Filtered to flagged expense.");
  }, [showToast]);

  const maxCategoryAmount = Math.max(1, ...categorySeries.map((row) => row.amount));
  const maxMonthAmount = Math.max(1, ...monthlySeries.map((row) => row.amount));

  return (
    <div>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Expenses Command Center</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: T.textMuted }}>
            Smart tracking, AI categorization, and spending insight.
          </p>
        </div>
      </div>

      {loadError ? (
        <div style={{ marginBottom: 12, border: `1px solid ${T.accent}`, background: T.accentLight, color: "#8B6914", borderRadius: 10, padding: "9px 11px", fontSize: 12 }}>
          Expense data source warning: {loadError.message || "Unable to load expenses/budgets table. Run latest Supabase migration."}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(6, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}>
        <SummaryCard title="This Month Spend" value={formatAud(summary.monthSpend)} sub={`${monthLabel(new Date())}`} />
        <SummaryCard title="GST Claimable" value={formatAud(summary.gstClaimable)} sub="Current month" />
        <SummaryCard title="Needs Review" value={String(summary.needsReview)} sub="Low confidence or pending" tone={summary.needsReview > 0 ? "warn" : "ok"} />
        <SummaryCard title="Recurring Vendors" value={String(summary.recurringVendorCount)} sub="3+ transactions" />
        <SummaryCard title="Duplicate Alerts" value={String(summary.duplicateCount)} sub="Possible duplicates" tone={summary.duplicateCount > 0 ? "warn" : "ok"} />
        <SummaryCard title="Budget Alerts" value={String(budgetAlertCount)} sub={monthLabel(`${budgetMonth}-01`)} tone={budgetAlertCount > 0 ? "warn" : "ok"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "360px 1fr", gap: 12 }}>
        <section style={{ ...panelStyle, padding: 14 }}>
          <div style={{ ...panelHeaderStyle, marginBottom: 4 }}>Quick Expense Capture</div>
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>
            Upload a receipt and let AI prefill the expense. Only adjust what is wrong.
          </div>

          <input
            ref={receiptInputRef}
            type="file"
            accept="image/*"
            onChange={onReceiptSelected}
            style={{ display: "none" }}
          />
          <button
            onClick={() => receiptInputRef.current?.click()}
            disabled={saving || analyzing}
            style={{
              width: "100%",
              border: `1.5px dashed ${T.primary}`,
              background: "linear-gradient(180deg, #F8FBF7 0%, #EEF5EC 100%)",
              borderRadius: 12,
              padding: "16px 12px",
              marginBottom: 10,
              textAlign: "left",
              cursor: saving || analyzing ? "not-allowed" : "pointer",
              opacity: saving || analyzing ? 0.7 : 1,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900, color: T.primaryDark, marginBottom: 3 }}>+ Upload Receipt</div>
            <div style={{ fontSize: 11, color: T.textMuted }}>
              Auto-detect amount, vendor, date, GST, and category.
            </div>
          </button>

          {form.receipt_data_url && (
            <div style={{ marginBottom: 10, border: `1px solid ${T.borderLight}`, borderRadius: 10, overflow: "hidden", background: "#FAFBF8" }}>
              <img src={form.receipt_data_url} alt="Receipt preview" style={{ width: "100%", display: "block", maxHeight: 200, objectFit: "cover" }} />
              <div style={{ padding: "6px 8px", fontSize: 11, color: T.textMuted }}>
                {form.receipt_file_name || "receipt.jpg"}
                {form.receipt_ocr_data_url ? " · AI optimized" : ""}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <FormLabel>Vendor</FormLabel>
              <input
                value={form.vendor}
                onChange={(e) => setForm((prev) => ({ ...prev, vendor: e.target.value }))}
                placeholder="Auto-filled from receipt"
                style={inputStyle}
              />
            </div>
            <div>
              <FormLabel>Amount (AUD)</FormLabel>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="Auto-filled from receipt"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div>
              <FormLabel>Category</FormLabel>
              <select
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                style={inputStyle}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <FormLabel>Date</FormLabel>
              <input
                type="date"
                value={toDateInputValue(form.expense_date)}
                onChange={(e) => setForm((prev) => ({ ...prev, expense_date: e.target.value }))}
                style={inputStyle}
              />
            </div>
          </div>

          {form.receipt_data_url && !Number(form.amount || 0) && !analyzing && (
            <div style={{ marginTop: 2, marginBottom: 8, border: `1px solid ${T.accent}`, background: T.accentLight, color: "#8B6914", borderRadius: 10, padding: "8px 10px", fontSize: 12 }}>
              Amount not detected yet. Tap "Re-analyze Receipt" or enter the total manually.
            </div>
          )}
          {analysisWarning && (
            <div style={{ marginTop: 2, marginBottom: 8, border: `1px solid ${T.accent}`, background: "#FFF8ED", color: "#8B6914", borderRadius: 10, padding: "8px 10px", fontSize: 12 }}>
              {analysisWarning}
            </div>
          )}

          {(form.ai_suggested_category || form.ai_confidence > 0) && (
            <div style={{ marginTop: 2, marginBottom: 8, background: T.primaryLight, borderRadius: 10, padding: "8px 10px" }}>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 2 }}>AI Suggestion</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.primaryDark }}>
                {categoryMeta(form.ai_suggested_category || form.category)?.label || "Uncategorized"} · {Math.round((form.ai_confidence || 0) * 100)}%
              </div>
              {form.ai_reasoning && (
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>{form.ai_reasoning}</div>
              )}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
            <button
              onClick={() => runAiExpenseAnalysis()}
              disabled={saving || analyzing}
              style={{ ...secondaryBtnStyle, opacity: saving || analyzing ? 0.7 : 1, cursor: saving || analyzing ? "not-allowed" : "pointer" }}
            >
              {analyzing ? "Analyzing..." : "Re-analyze Receipt"}
            </button>
            <button
              onClick={() => setShowAdvancedForm((prev) => !prev)}
              style={secondaryBtnStyle}
            >
              {showAdvancedForm ? "Hide Advanced" : "Show Advanced"}
            </button>
          </div>

          {showAdvancedForm && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${T.border}` }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <FormLabel>Payment Method</FormLabel>
                  <select
                    value={form.payment_method}
                    onChange={(e) => setForm((prev) => ({ ...prev, payment_method: e.target.value }))}
                    style={inputStyle}
                  >
                    {PAYMENT_METHODS.map((option) => (
                      <option key={option} value={option}>{option.replaceAll("_", " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <FormLabel>GST Amount</FormLabel>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.gst_amount}
                    onChange={(e) => setForm((prev) => ({ ...prev, gst_amount: e.target.value }))}
                    placeholder="Auto"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <input
                  id="gst-claimable"
                  type="checkbox"
                  checked={form.gst_claimable}
                  onChange={(e) => setForm((prev) => ({ ...prev, gst_claimable: e.target.checked }))}
                />
                <label htmlFor="gst-claimable" style={{ fontSize: 12, color: T.text }}>GST claimable</label>
              </div>

              <FormLabel>Notes</FormLabel>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
                style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
                placeholder="Optional context..."
              />
              <button
                onClick={handleSmartCategorizeLocal}
                disabled={saving || analyzing}
                style={{ ...secondaryBtnStyle, width: "100%", opacity: saving || analyzing ? 0.7 : 1, cursor: saving || analyzing ? "not-allowed" : "pointer" }}
              >
                Smart Categorize
              </button>
            </div>
          )}

          <button
            onClick={onSaveExpense}
            disabled={saving || analyzing}
            style={{ ...primaryBtnStyle, width: "100%", marginTop: 10, opacity: saving || analyzing ? 0.7 : 1, cursor: saving || analyzing ? "not-allowed" : "pointer" }}
          >
            {saving ? "Saving..." : "Save Expense"}
          </button>
        </section>

        <section style={{ display: "grid", gap: 12 }}>
          <div style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <div style={panelHeaderStyle}>Budget Control</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <select
                  value={budgetMonth}
                  onChange={(e) => setBudgetMonth(e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0, width: 130 }}
                >
                  {budgetMonthOptions.map((key) => (
                    <option key={key} value={key}>{monthLabel(`${key}-01`)}</option>
                  ))}
                </select>
                <button
                  onClick={saveBudgetTargets}
                  disabled={budgetSaving || Object.keys(budgetDrafts).length === 0}
                  style={{ ...smallBtnStyle, opacity: budgetSaving || Object.keys(budgetDrafts).length === 0 ? 0.6 : 1 }}
                >
                  {budgetSaving ? "Saving..." : "Save Targets"}
                </button>
              </div>
            </div>
            <div style={{ display: "grid", gap: 7 }}>
              {budgetEditorRows.map((row) => {
                const ratio = row.budget > 0 ? row.ratio : 0;
                const ratioPercent = row.budget > 0 ? Math.round(ratio * 100) : 0;
                const inputValue = budgetDrafts[row.key] ?? (row.budget > 0 ? String(row.budget) : "");
                const meterColor = ratio >= 1 ? T.danger : ratio >= 0.85 ? "#C08B52" : T.primary;
                return (
                  <div key={row.key} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 9px", display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{row.label}</div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>
                        {formatAud(row.spent)} / {row.budget > 0 ? formatAud(row.budget) : "No target"}
                      </div>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, overflow: "hidden", background: T.borderLight }}>
                      <div style={{ height: "100%", width: `${Math.min(100, Math.max(3, ratio * 100 || 3))}%`, background: meterColor }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Set budget"
                        value={inputValue}
                        onChange={(e) => handleBudgetDraftChange(row.key, e.target.value)}
                        style={{ ...inputStyle, marginBottom: 0, width: 160 }}
                      />
                      <div style={{ fontSize: 11, color: ratio >= 1 ? T.danger : ratio >= 0.85 ? "#8B6914" : T.textLight }}>
                        {row.budget > 0 ? `${ratioPercent}% used` : "No alert threshold"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={panelStyle}>
            <div style={panelHeaderStyle}>Anomaly Radar ({anomalies.length})</div>
            {anomalies.length === 0 ? (
              <div style={{ fontSize: 12, color: T.textMuted }}>No anomalies flagged right now.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {anomalies.map((item) => (
                  <div key={item.id} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 9px", display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>
                        {item.row?.vendor || "Budget / System Alert"}
                      </div>
                      <div style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: 0.3,
                        borderRadius: 999,
                        padding: "3px 8px",
                        fontWeight: 800,
                        background: item.severity === "high" ? "#FDEAEA" : item.severity === "medium" ? T.accentLight : T.primaryLight,
                        color: item.severity === "high" ? T.danger : item.severity === "medium" ? "#8B6914" : T.primaryDark,
                      }}>
                        {item.severity}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: T.textMuted }}>{item.message}</div>
                    {item.row ? (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <div style={{ fontSize: 11, color: T.textLight }}>
                          {toDateInputValue(item.row.expense_date)} · {formatAud(item.row.amount)}
                        </div>
                        <button onClick={() => focusAnomalyExpense(item.row)} style={smallBtnStyle}>
                          Review Expense
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <div style={panelHeaderStyle}>Review Queue ({reviewQueue.length})</div>
            {reviewQueue.length === 0 ? (
              <div style={{ fontSize: 12, color: T.textMuted }}>No pending items. Great work.</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {reviewQueue.slice(0, 8).map((row) => (
                  <div key={row.id} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 9px", display: "grid", gap: 7 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{row.vendor || "Unknown vendor"}</div>
                        <div style={{ fontSize: 11, color: T.textMuted }}>{toDateInputValue(row.expense_date)} · {formatAud(row.amount)}</div>
                      </div>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: Number(row.ai_confidence || 0) >= 0.75 ? T.primaryDark : "#8B6914",
                        background: Number(row.ai_confidence || 0) >= 0.75 ? T.primaryLight : T.accentLight,
                        borderRadius: 999,
                        padding: "3px 8px",
                        height: 22,
                      }}>
                        {Math.round(Number(row.ai_confidence || 0) * 100)}%
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <select
                        value={row.category || "uncategorized"}
                        onChange={(e) => changeRowCategory(row.id, e.target.value)}
                        style={{ ...inputStyle, marginBottom: 0, width: 200 }}
                      >
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => approveRow(row.id)}
                        style={smallBtnStyle}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => deleteRow(row.id)}
                        style={{ ...smallBtnStyle, color: T.danger }}
                      >
                        Delete
                      </button>
                    </div>
                    {row.ai_reasoning && <div style={{ fontSize: 11, color: T.textLight }}>{row.ai_reasoning}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <div style={panelHeaderStyle}>Spending Insights</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.1fr 0.9fr", gap: 12 }}>
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 8 }}>Category Breakdown</div>
                {categorySeries.length === 0 ? (
                  <div style={{ fontSize: 12, color: T.textMuted }}>No expenses yet.</div>
                ) : (
                  <div style={{ display: "grid", gap: 7 }}>
                    {categorySeries.slice(0, 8).map((row) => (
                      <div key={row.category} style={{ display: "grid", gap: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                          <span style={{ color: T.text }}>{row.meta?.label || row.category}</span>
                          <span style={{ color: T.textMuted }}>{formatAud(row.amount)}</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: T.borderLight, overflow: "hidden" }}>
                          <div style={{ width: `${Math.max(3, (row.amount / maxCategoryAmount) * 100)}%`, height: "100%", background: row.meta?.color || T.primary }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 8 }}>Monthly Trend</div>
                {monthlySeries.length === 0 ? (
                  <div style={{ fontSize: 12, color: T.textMuted }}>No monthly data yet.</div>
                ) : (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8, minHeight: 150 }}>
                    {monthlySeries.map((row) => (
                      <div key={row.key} style={{ flex: 1, textAlign: "center" }}>
                        <div title={formatAud(row.amount)} style={{ margin: "0 auto", width: "100%", maxWidth: 34, height: `${Math.max(8, (row.amount / maxMonthAmount) * 120)}px`, borderRadius: "8px 8px 0 0", background: T.primary }} />
                        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>{row.label.split(" ")[0]}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ marginTop: 12, border: `1px solid ${T.border}`, borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.text, marginBottom: 8 }}>Top Vendors</div>
              {topVendors.length === 0 ? (
                <div style={{ fontSize: 12, color: T.textMuted }}>No vendor data yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 7 }}>
                  {topVendors.map((row) => (
                    <div key={row.vendor} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: T.text }}>{row.vendor}</span>
                      <span style={{ color: T.textMuted }}>{formatAud(row.amount)} · {row.count}x</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <div style={panelHeaderStyle}>All Expenses ({filteredExpenses.length})</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search vendor or notes"
                  style={{ ...inputStyle, marginBottom: 0, width: 190 }}
                />
                <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={{ ...inputStyle, marginBottom: 0, width: 120 }}>
                  <option value="all">All months</option>
                  {months.map((key) => (
                    <option key={key} value={key}>{monthLabel(`${key}-01`)}</option>
                  ))}
                </select>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ ...inputStyle, marginBottom: 0, width: 150 }}>
                  <option value="all">All categories</option>
                  {CATEGORY_OPTIONS.map((row) => (
                    <option key={row.id} value={row.id}>{row.label}</option>
                  ))}
                </select>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ ...inputStyle, marginBottom: 0, width: 130 }}>
                  <option value="all">All status</option>
                  {STATUS_OPTIONS.map((row) => (
                    <option key={row} value={row}>{row.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </div>
            </div>

            {filteredExpenses.length === 0 ? (
              <div style={{ fontSize: 12, color: T.textMuted }}>No expenses match your filters.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Date", "Vendor", "Category", "Amount", "GST", "Status", "AI", "Receipt", "Actions"].map((label) => (
                        <th key={label} style={{ textAlign: "left", padding: "8px 6px", borderBottom: `1px solid ${T.border}`, fontSize: 11, color: T.textMuted, fontWeight: 800 }}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((row) => {
                      const meta = categoryMeta(row.category);
                      return (
                        <tr key={row.id}>
                          <td style={tdStyle}>{toDateInputValue(row.expense_date)}</td>
                          <td style={tdStyle}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{row.vendor || "-"}</div>
                            {row.notes ? <div style={{ fontSize: 10, color: T.textLight, maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.notes}</div> : null}
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, background: `${meta?.color || T.primary}22`, color: meta?.color || T.primaryDark, padding: "4px 8px" }}>
                              {meta?.label || row.category}
                            </span>
                          </td>
                          <td style={tdStyle}>{formatAud(row.amount)}</td>
                          <td style={tdStyle}>{row.gst_claimable ? formatAud(row.gst_amount) : "No"}</td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, background: row.status === "approved" ? T.primaryLight : T.accentLight, color: row.status === "approved" ? T.primaryDark : "#8B6914", padding: "4px 8px" }}>
                              {String(row.status || "needs_review").replaceAll("_", " ")}
                            </span>
                          </td>
                          <td style={tdStyle}>{Math.round(Number(row.ai_confidence || 0) * 100)}%</td>
                          <td style={tdStyle}>
                            {row.receipt_data_url ? (
                              <a href={row.receipt_data_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: T.blue, fontWeight: 700 }}>View</a>
                            ) : (
                              <span style={{ fontSize: 11, color: T.textLight }}>-</span>
                            )}
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                onClick={() => toggleRowApproval(row)}
                                style={smallBtnStyle}
                              >
                                {row.status === "approved" ? "Unapprove" : "Approve"}
                              </button>
                              <button onClick={() => deleteRow(row.id)} style={{ ...smallBtnStyle, color: T.danger }}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function prevOrBlank(value, fallback) {
  const text = String(value || "").trim();
  return text ? text : fallback;
}

function SummaryCard({ title, value, sub, tone = "default" }) {
  const toneStyles = tone === "warn"
    ? { bg: "#F8F1E1", color: "#8B6914" }
    : tone === "ok"
      ? { bg: T.primaryLight, color: T.primaryDark }
      : { bg: "#fff", color: T.text };
  return (
    <div style={{ background: toneStyles.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", fontWeight: 700 }}>{title}</div>
      <div style={{ marginTop: 3, fontSize: 19, fontWeight: 900, color: toneStyles.color }}>{value}</div>
      <div style={{ marginTop: 2, fontSize: 11, color: T.textLight }}>{sub}</div>
    </div>
  );
}

function FormLabel({ children }) {
  return (
    <div style={{ fontSize: 11, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.3, margin: "2px 0 4px", fontWeight: 700 }}>
      {children}
    </div>
  );
}

const panelStyle = {
  background: "#fff",
  borderRadius: T.radius,
  boxShadow: T.shadow,
  border: `1px solid ${T.border}`,
  padding: 12,
};

const panelHeaderStyle = {
  marginBottom: 8,
  fontSize: 14,
  fontWeight: 900,
  color: T.text,
};

const inputStyle = {
  width: "100%",
  border: `1.5px solid ${T.border}`,
  background: "#fff",
  borderRadius: 9,
  padding: "8px 10px",
  color: T.text,
  fontSize: 13,
  boxSizing: "border-box",
  marginBottom: 8,
};

const primaryBtnStyle = {
  border: "none",
  background: T.primary,
  color: "#fff",
  borderRadius: 9,
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 800,
};

const secondaryBtnStyle = {
  border: `1px solid ${T.border}`,
  background: "#fff",
  color: T.text,
  borderRadius: 9,
  padding: "9px 10px",
  fontSize: 12,
  fontWeight: 700,
};

const smallBtnStyle = {
  border: `1px solid ${T.border}`,
  background: "#fff",
  color: T.text,
  borderRadius: 8,
  padding: "5px 8px",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};

const tdStyle = {
  padding: "8px 6px",
  borderBottom: `1px solid ${T.borderLight}`,
  fontSize: 12,
  color: T.text,
  verticalAlign: "top",
};
