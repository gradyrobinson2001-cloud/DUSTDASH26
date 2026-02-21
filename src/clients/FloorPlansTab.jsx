import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, supabaseReady } from "../lib/supabase";
import { T } from "../shared";

export default function FloorPlansTab({ clients = [], isMobile }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | with_plan | without_plan
  const [floorPlansByClient, setFloorPlansByClient] = useState({});
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!supabaseReady || !supabase) {
      setFloorPlansByClient({});
      return;
    }

    let mounted = true;
    const loadIndex = async () => {
      const { data, error } = await supabase
        .from("floor_plans")
        .select("client_id, updated_at");
      if (!mounted) return;
      if (error) {
        setLoadError(error.message || "Failed to load floor plans.");
        return;
      }
      setLoadError("");
      const next = {};
      (data || []).forEach((row) => {
        next[String(row.client_id)] = {
          updatedAt: row.updated_at || null,
        };
      });
      setFloorPlansByClient(next);
    };

    loadIndex();
    const ch = supabase
      .channel("floorplans:index")
      .on("postgres_changes", { event: "*", schema: "public", table: "floor_plans" }, loadIndex)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...clients]
      .filter((client) => {
        const hasPlan = Boolean(floorPlansByClient[String(client.id)]);
        if (filter === "with_plan" && !hasPlan) return false;
        if (filter === "without_plan" && hasPlan) return false;
        if (!q) return true;
        return (
          String(client?.name || "").toLowerCase().includes(q) ||
          String(client?.suburb || "").toLowerCase().includes(q) ||
          String(client?.address || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
  }, [clients, filter, floorPlansByClient, search]);

  const withPlanCount = Object.keys(floorPlansByClient).length;

  return (
    <div>
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Floor Plans</h1>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: T.textMuted }}>
            {withPlanCount} plans created · {clients.length} clients
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client or suburb..."
            style={{ padding: "9px 12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, minWidth: isMobile ? 0 : 240, fontSize: 13 }}
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ padding: "9px 12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, fontSize: 13, color: T.text, background: "#fff" }}
          >
            <option value="all">All clients</option>
            <option value="with_plan">With floor plan</option>
            <option value="without_plan">Without floor plan</option>
          </select>
        </div>
      </div>

      {loadError && (
        <div style={{ marginBottom: 10, padding: "9px 11px", borderRadius: T.radiusSm, background: "#FCEAEA", color: T.danger, fontSize: 12, fontWeight: 700 }}>
          {loadError}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 10 }}>
        {rows.map((client) => {
          const record = floorPlansByClient[String(client.id)] || null;
          const hasPlan = Boolean(record);
          return (
            <div key={client.id} style={{ background: "#fff", borderRadius: T.radius, boxShadow: T.shadow, border: `1px solid ${T.borderLight}`, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{client.name}</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>{client.suburb || "No suburb"}</div>
                  <div style={{ fontSize: 11, color: T.textLight }}>
                    {hasPlan ? `Updated ${new Date(record.updatedAt).toLocaleString("en-AU")}` : "No floor plan yet"}
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/dashboard/clients/${client.id}/floorplan`)}
                  style={{ padding: "9px 12px", borderRadius: T.radiusSm, border: `1.5px solid ${hasPlan ? T.primary : T.blue}`, background: hasPlan ? T.primaryLight : T.blueLight, color: hasPlan ? T.primaryDark : T.blue, fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  {hasPlan ? "View" : "Create"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {rows.length === 0 && (
        <div style={{ marginTop: 14, padding: 26, textAlign: "center", borderRadius: T.radius, background: "#fff", boxShadow: T.shadow, color: T.textMuted, fontSize: 13 }}>
          No clients found for this filter.
        </div>
      )}
    </div>
  );
}
