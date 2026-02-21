import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, supabaseReady } from "../lib/supabase";

const STORAGE_KEY = "db_marketing_templates";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_RE.test(String(value || "").trim());
}

function newTemplateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const hex = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${hex()}${hex()}-${hex()}-4${hex().slice(1)}-a${hex().slice(1)}-${hex()}${hex()}${hex()}`;
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocal(rows) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {}
}

function normalizeRow(row) {
  const id = String(row?.id || "").trim();
  return {
    id: id || newTemplateId(),
    name: String(row?.name || "Untitled Campaign"),
    prompt: String(row?.prompt || ""),
    data: row?.data || {},
    created_at: row?.created_at || new Date().toISOString(),
    updated_at: row?.updated_at || new Date().toISOString(),
  };
}

export function useMarketingTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingLocal, setUsingLocal] = useState(!supabaseReady);
  const fetchRunningRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!supabaseReady || !supabase || usingLocal || fetchRunningRef.current) return;
    fetchRunningRef.current = true;
    try {
      const { data, error } = await supabase
        .from("marketing_templates")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(200);

      if (error) {
        setUsingLocal(true);
        const local = loadLocal();
        setTemplates(local.map(normalizeRow));
        return;
      }

      const rows = (data || []).map(normalizeRow);
      setTemplates(rows);
      saveLocal(rows);
    } finally {
      fetchRunningRef.current = false;
      setLoading(false);
    }
  }, [usingLocal]);

  useEffect(() => {
    if (!supabaseReady || !supabase) {
      setUsingLocal(true);
      const local = loadLocal();
      setTemplates(local.map(normalizeRow));
      setLoading(false);
      return;
    }

    refresh();
    const channel = supabase
      .channel("marketing_templates")
      .on("postgres_changes", { event: "*", schema: "public", table: "marketing_templates" }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const upsertTemplate = useCallback(async (row) => {
    const now = new Date().toISOString();
    const payload = normalizeRow({ ...row, updated_at: now, created_at: row?.created_at || now });
    const safeId = isUuid(payload.id) ? payload.id : newTemplateId();
    const safePayload = safeId === payload.id ? payload : { ...payload, id: safeId };

    if (usingLocal || !supabaseReady || !supabase) {
      setTemplates((prev) => {
        const next = [safePayload, ...prev.filter((item) => String(item.id) !== String(safePayload.id))];
        saveLocal(next);
        return next;
      });
      return safePayload;
    }

    const { data, error } = await supabase
      .from("marketing_templates")
      .upsert({
        id: safePayload.id,
        name: safePayload.name,
        prompt: safePayload.prompt,
        data: safePayload.data,
        updated_at: safePayload.updated_at,
      }, { onConflict: "id" })
      .select("*")
      .single();

    if (error || !data) {
      setUsingLocal(true);
      setTemplates((prev) => {
        const next = [safePayload, ...prev.filter((item) => String(item.id) !== String(safePayload.id))];
        saveLocal(next);
        return next;
      });
      return safePayload;
    }

    const normalized = normalizeRow(data);
    setTemplates((prev) => {
      const next = [normalized, ...prev.filter((item) => String(item.id) !== String(normalized.id))];
      saveLocal(next);
      return next;
    });
    return normalized;
  }, [usingLocal]);

  const removeTemplate = useCallback(async (id) => {
    const key = String(id || "");
    if (!key) return;
    setTemplates((prev) => {
      const next = prev.filter((row) => String(row.id) !== key);
      saveLocal(next);
      return next;
    });
    if (usingLocal || !supabaseReady || !supabase) return;
    await supabase.from("marketing_templates").delete().eq("id", key);
  }, [usingLocal]);

  return {
    templates,
    loading,
    usingLocal,
    refreshTemplates: refresh,
    upsertTemplate,
    removeTemplate,
  };
}
