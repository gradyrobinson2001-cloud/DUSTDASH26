import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, supabaseReady } from "../lib/supabase";

const EXPENSE_STORAGE_KEY = "db_expenses";
const BUDGET_STORAGE_KEY = "db_expense_budgets";

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function nowIsoDate() {
  return new Date().toISOString().split("T")[0];
}

function monthKey(dateLike = Date.now()) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return nowIsoDate().slice(0, 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeExpense(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.id || `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    expense_date: row.expense_date || nowIsoDate(),
    vendor: String(row.vendor || "").trim(),
    amount: Math.max(0, toNumber(row.amount, 0)),
    gst_amount: Math.max(0, toNumber(row.gst_amount, 0)),
    gst_claimable: row.gst_claimable !== false,
    category: String(row.category || "uncategorized").trim() || "uncategorized",
    status: String(row.status || "needs_review").trim() || "needs_review",
    payment_method: String(row.payment_method || "").trim() || "card",
    notes: String(row.notes || ""),
    receipt_data_url: String(row.receipt_data_url || ""),
    receipt_file_name: String(row.receipt_file_name || ""),
    ai_suggested_category: String(row.ai_suggested_category || ""),
    ai_confidence: Math.max(0, Math.min(1, toNumber(row.ai_confidence, 0))),
    ai_reasoning: String(row.ai_reasoning || ""),
    is_recurring: Boolean(row.is_recurring),
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

function normalizeBudget(row) {
  if (!row) return null;
  return {
    ...row,
    id: row.id || `exp_budget_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    month_key: String(row.month_key || monthKey()).slice(0, 7),
    category: String(row.category || "all").trim().toLowerCase() || "all",
    budget_amount: Math.max(0, toNumber(row.budget_amount, 0)),
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

function readLocalArray(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalArray(key, rows) {
  try {
    localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    // ignore local storage failures
  }
}

function isMissingTableError(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const message = String(error.message || "").toLowerCase();
  return code === "42P01" || message.includes("does not exist") || message.includes("relation");
}

export function useExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expenseError, setExpenseError] = useState(null);
  const [budgetError, setBudgetError] = useState(null);
  const fetchingExpensesRef = useRef(false);
  const fetchingBudgetsRef = useRef(false);

  const refreshExpenses = useCallback(async () => {
    if (!supabaseReady || !supabase || fetchingExpensesRef.current) return;
    fetchingExpensesRef.current = true;
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        if (isMissingTableError(error)) {
          setExpenseError(new Error("Supabase table 'expenses' is missing. Run the latest migration."));
          setExpenses(readLocalArray(EXPENSE_STORAGE_KEY).map(normalizeExpense).filter(Boolean));
          return;
        }
        setExpenseError(error);
        return;
      }

      setExpenseError(null);
      setExpenses((data || []).map(normalizeExpense).filter(Boolean));
    } finally {
      fetchingExpensesRef.current = false;
      setLoading(false);
    }
  }, []);

  const refreshBudgets = useCallback(async () => {
    if (!supabaseReady || !supabase || fetchingBudgetsRef.current) return;
    fetchingBudgetsRef.current = true;
    try {
      const { data, error } = await supabase
        .from("expense_budgets")
        .select("*")
        .order("month_key", { ascending: false })
        .order("category", { ascending: true });

      if (error) {
        if (isMissingTableError(error)) {
          setBudgetError(new Error("Supabase table 'expense_budgets' is missing. Run the latest migration."));
          setBudgets(readLocalArray(BUDGET_STORAGE_KEY).map(normalizeBudget).filter(Boolean));
          return;
        }
        setBudgetError(error);
        return;
      }

      setBudgetError(null);
      setBudgets((data || []).map(normalizeBudget).filter(Boolean));
    } finally {
      fetchingBudgetsRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!supabaseReady || !supabase) {
      setExpenses(readLocalArray(EXPENSE_STORAGE_KEY).map(normalizeExpense).filter(Boolean));
      setBudgets(readLocalArray(BUDGET_STORAGE_KEY).map(normalizeBudget).filter(Boolean));
      setLoading(false);
      return;
    }

    let mounted = true;
    const safeRefresh = async () => {
      if (!mounted) return;
      await Promise.allSettled([refreshExpenses(), refreshBudgets()]);
    };
    safeRefresh();

    const expenseChannel = supabase
      .channel("expenses")
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, safeRefresh)
      .subscribe();

    const budgetChannel = supabase
      .channel("expense_budgets")
      .on("postgres_changes", { event: "*", schema: "public", table: "expense_budgets" }, safeRefresh)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(expenseChannel);
      supabase.removeChannel(budgetChannel);
    };
  }, [refreshBudgets, refreshExpenses]);

  const addExpenseLocal = useCallback((normalized) => {
    const localRow = { ...normalized, id: normalized.id || `exp_${Date.now()}` };
    setExpenses((prev) => {
      const next = [localRow, ...prev];
      writeLocalArray(EXPENSE_STORAGE_KEY, next);
      return next;
    });
    return localRow;
  }, []);

  const updateExpenseLocal = useCallback((id, normalizedUpdates) => {
    const key = String(id || "");
    setExpenses((prev) => {
      const next = prev.map((row) => (
        String(row.id) === key ? normalizeExpense({ ...row, ...normalizedUpdates }) : row
      ));
      writeLocalArray(EXPENSE_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const removeExpenseLocal = useCallback((id) => {
    const key = String(id || "");
    setExpenses((prev) => {
      const next = prev.filter((row) => String(row.id) !== key);
      writeLocalArray(EXPENSE_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const addExpense = async (expense) => {
    const normalized = normalizeExpense(expense);
    if (!normalized) throw new Error("Invalid expense payload.");

    if (!supabaseReady || !supabase) return addExpenseLocal(normalized);

    const payload = { ...normalized };
    delete payload.id;
    const { data, error } = await supabase
      .from("expenses")
      .insert(payload)
      .select("*")
      .single();

    if (error || !data) {
      if (isMissingTableError(error)) {
        setExpenseError(new Error("Supabase table 'expenses' is missing. Saving locally."));
        return addExpenseLocal(normalized);
      }
      throw error || new Error("Failed to create expense.");
    }

    setExpenseError(null);
    const inserted = normalizeExpense(data);
    setExpenses((prev) => [inserted, ...prev.filter((row) => String(row.id) !== String(inserted.id))]);
    return inserted;
  };

  const updateExpense = async (id, updates) => {
    const key = String(id || "");
    if (!key) throw new Error("Expense ID is required.");
    const normalizedUpdates = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (!supabaseReady || !supabase) {
      updateExpenseLocal(key, normalizedUpdates);
      return;
    }

    const { data, error } = await supabase
      .from("expenses")
      .update(normalizedUpdates)
      .eq("id", key)
      .select("*")
      .single();

    if (error || !data) {
      if (isMissingTableError(error)) {
        setExpenseError(new Error("Supabase table 'expenses' is missing. Updating locally."));
        updateExpenseLocal(key, normalizedUpdates);
        return;
      }
      throw error || new Error("Failed to update expense.");
    }

    setExpenseError(null);
    const updated = normalizeExpense(data);
    setExpenses((prev) => prev.map((row) => (String(row.id) === key ? updated : row)));
  };

  const removeExpense = async (id) => {
    const key = String(id || "");
    if (!key) return;

    if (!supabaseReady || !supabase) {
      removeExpenseLocal(key);
      return;
    }

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", key);

    if (error) {
      if (isMissingTableError(error)) {
        setExpenseError(new Error("Supabase table 'expenses' is missing. Deleting locally."));
        removeExpenseLocal(key);
        return;
      }
      throw error;
    }

    setExpenseError(null);
    setExpenses((prev) => prev.filter((row) => String(row.id) !== key));
  };

  const upsertBudgetLocal = useCallback((budgetPayload) => {
    const normalized = normalizeBudget(budgetPayload);
    if (!normalized) return null;
    let saved = normalized;
    setBudgets((prev) => {
      const existing = prev.find((row) => row.month_key === normalized.month_key && row.category === normalized.category);
      const next = existing
        ? prev.map((row) => (
            row.month_key === normalized.month_key && row.category === normalized.category
              ? { ...row, ...normalized, id: row.id || normalized.id }
              : row
          ))
        : [normalized, ...prev];
      const matched = next.find((row) => row.month_key === normalized.month_key && row.category === normalized.category);
      if (matched) saved = matched;
      writeLocalArray(BUDGET_STORAGE_KEY, next);
      return next;
    });
    return saved;
  }, []);

  const removeBudgetLocal = useCallback((id) => {
    const key = String(id || "");
    setBudgets((prev) => {
      const next = prev.filter((row) => String(row.id) !== key);
      writeLocalArray(BUDGET_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const upsertBudget = async ({ month_key, category = "all", budget_amount }) => {
    const normalized = normalizeBudget({ month_key, category, budget_amount });
    if (!normalized) throw new Error("Invalid budget payload.");

    if (!supabaseReady || !supabase) return upsertBudgetLocal(normalized);

    const payload = {
      month_key: normalized.month_key,
      category: normalized.category,
      budget_amount: normalized.budget_amount,
    };
    const { data, error } = await supabase
      .from("expense_budgets")
      .upsert(payload, { onConflict: "month_key,category" })
      .select("*")
      .single();

    if (error || !data) {
      if (isMissingTableError(error)) {
        setBudgetError(new Error("Supabase table 'expense_budgets' is missing. Saving budget locally."));
        return upsertBudgetLocal(normalized);
      }
      throw error || new Error("Failed to save budget.");
    }

    setBudgetError(null);
    const saved = normalizeBudget(data);
    setBudgets((prev) => {
      const exists = prev.some((row) => row.month_key === saved.month_key && row.category === saved.category);
      return exists
        ? prev.map((row) => (
            row.month_key === saved.month_key && row.category === saved.category ? saved : row
          ))
        : [saved, ...prev];
    });
    return saved;
  };

  const removeBudget = async (budgetId) => {
    const key = String(budgetId || "");
    if (!key) return;

    if (!supabaseReady || !supabase) {
      removeBudgetLocal(key);
      return;
    }

    const { error } = await supabase
      .from("expense_budgets")
      .delete()
      .eq("id", key);

    if (error) {
      if (isMissingTableError(error)) {
        setBudgetError(new Error("Supabase table 'expense_budgets' is missing. Deleting local budget."));
        removeBudgetLocal(key);
        return;
      }
      throw error;
    }

    setBudgetError(null);
    setBudgets((prev) => prev.filter((row) => String(row.id) !== key));
  };

  return {
    expenses,
    budgets,
    setExpenses,
    loading,
    error: expenseError || budgetError || null,
    expenseError,
    budgetError,
    refreshExpenses,
    refreshBudgets,
    addExpense,
    updateExpense,
    removeExpense,
    upsertBudget,
    removeBudget,
  };
}
