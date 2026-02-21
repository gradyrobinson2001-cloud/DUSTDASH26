import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { T, SERVICED_AREAS, calculateDuration } from "../shared";
import { SearchInput } from "../components/ui";
import { isEmail, isPhone, errorStyle } from "../utils/validate";
import { supabase, supabaseReady } from "../lib/supabase";

// ═══════════════════════════════════════════════════════════
// CLIENTS TAB — Full Revamp
// Rich client cards: all fields, notes, house details
// Sorting: name, suburb, frequency, status, added date
// Filtering: status, team, suburb
// Add / Edit / Delete inline
// ═══════════════════════════════════════════════════════════

const SORT_OPTIONS = [
  { id: "name",      label: "Name A–Z" },
  { id: "name_desc", label: "Name Z–A" },
  { id: "suburb",    label: "Suburb" },
  { id: "frequency", label: "Frequency" },
  { id: "status",    label: "Status" },
  { id: "added",     label: "Recently Added" },
];

const FREQ_ORDER = { weekly: 0, fortnightly: 1, monthly: 2 };

const STATUS_INFO = {
  active:    { bg: "#E8F5EE", color: "#2D7A5E", label: "Active" },
  paused:    { bg: "#FFF8E7", color: "#8B6914", label: "Paused" },
  cancelled: { bg: "#FDF0EF", color: "#D4645C", label: "Cancelled" },
  client:    { bg: "#E8F5EE", color: "#2D7A5E", label: "Client ✓" },
  lead:      { bg: "#FFF8E7", color: "#8B6914", label: "Lead" },
};

function StatusBadge({ status }) {
  const s = STATUS_INFO[status] || STATUS_INFO.active;
  return <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>;
}

export default function ClientsTab({
  clients,
  clientSearch,
  setClientSearch,
  scheduleSettings,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
  onLoadDemoClients,
  isMobile,
}) {
  const [sortBy,        setSortBy]       = useState("name");
  const [filterStatus,  setFilterStatus] = useState("all");
  const [filterSuburb,  setFilterSuburb] = useState("all");
  const [expandedId,    setExpandedId]   = useState(null);
  const [editingId,     setEditingId]    = useState(null); // null | "new" | client.id
  const [showFilters,   setShowFilters]  = useState(false);
  const [loadingDemo,   setLoadingDemo]  = useState(false);
  const [floorPlanClientIds, setFloorPlanClientIds] = useState(() => new Set());
  const navigate = useNavigate();

  const settings = scheduleSettings || {};
  const allSuburbs = [...new Set(clients.map(c => c.suburb).filter(Boolean))].sort();

  useEffect(() => {
    if (!supabaseReady || !supabase) {
      setFloorPlanClientIds(new Set());
      return;
    }

    let mounted = true;
    const refreshFloorPlanIndex = async () => {
      const { data, error } = await supabase
        .from("floor_plans")
        .select("client_id");
      if (!mounted || error) return;
      setFloorPlanClientIds(new Set((data || []).map((row) => String(row.client_id))));
    };

    refreshFloorPlanIndex();
    const ch = supabase
      .channel("clients:floor-plans")
      .on("postgres_changes", { event: "*", schema: "public", table: "floor_plans" }, refreshFloorPlanIndex)
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);

  // ── Filter ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...clients];
    if (clientSearch) {
      const t = clientSearch.toLowerCase();
      list = list.filter(c =>
        c.name?.toLowerCase().includes(t) ||
        c.email?.toLowerCase().includes(t) ||
        c.phone?.includes(t) ||
        c.suburb?.toLowerCase().includes(t) ||
        c.address?.toLowerCase().includes(t)
      );
    }
    if (filterStatus !== "all") list = list.filter(c => c.status === filterStatus);
    if (filterSuburb !== "all") list = list.filter(c => c.suburb === filterSuburb);
    return list;
  }, [clients, clientSearch, filterStatus, filterSuburb]);

  // ── Sort ────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sortBy) {
      case "name":       return list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      case "name_desc":  return list.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
      case "suburb":     return list.sort((a, b) => (a.suburb || "").localeCompare(b.suburb || ""));
      case "frequency":  return list.sort((a, b) => (FREQ_ORDER[a.frequency] ?? 9) - (FREQ_ORDER[b.frequency] ?? 9));
      case "status":     return list.sort((a, b) => (a.status || "").localeCompare(b.status || ""));
      case "added":      return list.sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0));
      default:           return list;
    }
  }, [filtered, sortBy]);

  const activeCount   = clients.filter(c => c.status === "active").length;
  const demoCount     = clients.filter(c => c.is_demo || c.isDemo).length;
  const activeFilters = [filterStatus !== "all", filterSuburb !== "all"].filter(Boolean).length;

  return (
    <div>
      {/* ── Header ─────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 24, fontWeight: 900, color: T.text }}>Clients</h1>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: T.textMuted }}>
            {activeCount} active · {clients.length} total
            {demoCount > 0 && <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 10, fontSize: 11, background: T.accentLight, color: "#8B6914" }}>🧪 {demoCount} demo</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {demoCount > 0 && onLoadDemoClients && (
            <button
              onClick={async () => {
                if (!window.confirm("Remove all demo clients?")) return;
                setLoadingDemo(true);
                try { await onLoadDemoClients("remove"); } finally { setLoadingDemo(false); }
              }}
              disabled={loadingDemo}
              style={{ padding: "11px 16px", borderRadius: T.radiusSm, border: `1.5px solid ${T.danger}`, background: T.dangerLight, color: T.danger, fontWeight: 700, fontSize: 13, cursor: loadingDemo ? "wait" : "pointer", opacity: loadingDemo ? 0.6 : 1 }}
            >
              {loadingDemo ? "Removing…" : `🗑️ Remove ${demoCount} Demo`}
            </button>
          )}
          {demoCount === 0 && onLoadDemoClients && (
            <button
              onClick={async () => {
                setLoadingDemo(true);
                try { await onLoadDemoClients("load"); } finally { setLoadingDemo(false); }
              }}
              disabled={loadingDemo}
              style={{ padding: "11px 16px", borderRadius: T.radiusSm, border: `1.5px solid ${T.accent}`, background: T.accentLight, color: "#8B6914", fontWeight: 700, fontSize: 13, cursor: loadingDemo ? "wait" : "pointer", opacity: loadingDemo ? 0.6 : 1 }}
            >
              {loadingDemo ? "Loading…" : "🧪 Load 70 Demo Clients"}
            </button>
          )}
          <button
            onClick={() => { setEditingId("new"); setExpandedId(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            style={{ padding: "11px 20px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            + Add Client
          </button>
        </div>
      </div>

      {/* ── New Client Form ────────────────────────────── */}
      {editingId === "new" && (
        <ClientForm
          client={{}}
          settings={settings}
          onSave={async data => { await onAddClient(data); setEditingId(null); }}
          onClose={() => setEditingId(null)}
          isNew
          isMobile={isMobile}
        />
      )}

      {/* ── Search + Sort + Filter ─────────────────────── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <SearchInput value={clientSearch} onChange={setClientSearch} placeholder="Search name, suburb, email, phone…" />
        </div>
        <select
          value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{ padding: "9px 12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, fontSize: 13, color: T.text, background: "#fff", cursor: "pointer" }}
        >
          {SORT_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <button
          onClick={() => setShowFilters(v => !v)}
          style={{ padding: "9px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${activeFilters > 0 ? T.primary : T.border}`, background: activeFilters > 0 ? T.primaryLight : "#fff", color: activeFilters > 0 ? T.primaryDark : T.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          ⚙️ Filter{activeFilters > 0 ? ` (${activeFilters})` : ""}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, padding: "14px 16px", background: "#fff", borderRadius: T.radiusSm, border: `1px solid ${T.border}` }}>
          <FSelect label="Status" value={filterStatus} onChange={setFilterStatus} options={[
            { value: "all", label: "All Statuses" },
            { value: "active", label: "Active" },
            { value: "paused", label: "Paused" },
            { value: "cancelled", label: "Cancelled" },
          ]} />
          <FSelect label="Suburb" value={filterSuburb} onChange={setFilterSuburb} options={[
            { value: "all", label: "All Suburbs" },
            ...allSuburbs.map(s => ({ value: s, label: s })),
          ]} />
          {activeFilters > 0 && (
            <button onClick={() => { setFilterStatus("all"); setFilterSuburb("all"); }}
              style={{ alignSelf: "flex-end", padding: "8px 12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.danger}`, background: T.dangerLight, color: T.danger, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Clear Filters
            </button>
          )}
        </div>
      )}

      <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>
        Showing {sorted.length} of {clients.length} clients
      </div>

      {/* ── Client List ────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sorted.map(c => {
          const isExpanded = expandedId === c.id;
          const isEditing  = editingId  === c.id;
          const dur        = c.custom_duration || c.customDuration || c.estimated_duration || c.estimatedDuration;
          const initials   = (c.name || "?").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
          const isDemo     = c.is_demo || c.isDemo;
          const hasFloorPlan = floorPlanClientIds.has(String(c.id));

          if (isEditing) {
            return (
              <ClientForm
                key={c.id}
                client={c}
                settings={settings}
                onSave={async data => { await onUpdateClient(c.id, data); setEditingId(null); }}
                onDelete={async () => { if (window.confirm(`Delete ${c.name}?`)) { await onDeleteClient(c.id); setEditingId(null); } }}
                onClose={() => setEditingId(null)}
                isNew={false}
                isMobile={isMobile}
              />
            );
          }

          return (
            <div key={c.id} style={{ background: "#fff", borderRadius: T.radius, overflow: "hidden", boxShadow: T.shadow, border: `1px solid ${isExpanded ? T.primary : T.border}`, transition: "border-color 0.15s" }}>
              {/* Summary row */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : c.id)}
                style={{ padding: isMobile ? "12px 14px" : "14px 18px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", flexWrap: "wrap" }}
              >
                <div style={{ width: 42, height: 42, borderRadius: 11, background: isDemo ? T.accentLight : `linear-gradient(135deg, ${T.primary}, ${T.blue})`, display: "flex", alignItems: "center", justifyContent: "center", color: isDemo ? "#8B6914" : "#fff", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                  {initials}
                </div>

                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: T.text }}>{c.name}</span>
                    {isDemo && <span style={{ padding: "1px 7px", borderRadius: 10, fontSize: 10, fontWeight: 700, background: T.accentLight, color: "#8B6914" }}>demo</span>}
                    <StatusBadge status={c.status} />
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                    📍 {c.suburb}
                    {c.frequency && <span style={{ marginLeft: 8 }}>· {c.frequency.charAt(0).toUpperCase() + c.frequency.slice(1)}</span>}
                    {(c.bedrooms || c.bathrooms) && <span style={{ marginLeft: 8 }}>· 🛏{c.bedrooms || 0} 🚿{c.bathrooms || 0}</span>}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, flexShrink: 0 }}>
                  {c.phone && <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()} style={{ color: T.primary, textDecoration: "none", fontWeight: 600 }}>📱 {c.phone}</a>}
                  {c.email && <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} style={{ color: T.blue, textDecoration: "none" }}>✉️ {c.email}</a>}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/dashboard/clients/${c.id}/floorplan`);
                  }}
                  style={{
                    padding: "7px 10px",
                    borderRadius: T.radiusSm,
                    border: `1.5px solid ${hasFloorPlan ? T.primary : T.blue}`,
                    background: hasFloorPlan ? T.primaryLight : T.blueLight,
                    color: hasFloorPlan ? T.primaryDark : T.blue,
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  {hasFloorPlan ? "View Floor Plan" : "Create Floor Plan"}
                </button>

                <span style={{ fontSize: 12, color: T.textMuted, transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>▶</span>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ borderTop: `1px solid ${T.border}`, padding: isMobile ? "14px" : "18px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>

                    {/* Contact */}
                    <DetailSection title="Contact Details">
                      <DetailRow icon="📛" label="Name"    value={c.name} />
                      <DetailRow icon="✉️" label="Email"   value={c.email && <a href={`mailto:${c.email}`} style={{ color: T.blue }}>{c.email}</a>} />
                      <DetailRow icon="📱" label="Phone"   value={c.phone && <a href={`tel:${c.phone}`} style={{ color: T.primary }}>{c.phone}</a>} />
                      <DetailRow icon="🏠" label="Address" value={c.address} />
                      {!c.address && <DetailRow icon="📍" label="Suburb" value={c.suburb} />}
                    </DetailSection>

                    {/* House */}
                    <DetailSection title="House Details">
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                        {[["🛏", "Bedrooms", c.bedrooms], ["🚿", "Bathrooms", c.bathrooms], ["🛋", "Living", c.living], ["🍳", "Kitchen", c.kitchen]].map(([icon, lbl, val]) =>
                          val !== undefined && (
                            <div key={lbl} style={{ background: T.bg, borderRadius: T.radiusSm, padding: "8px", textAlign: "center" }}>
                              <div style={{ fontSize: 16 }}>{icon}</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{val}</div>
                              <div style={{ fontSize: 10, color: T.textMuted }}>{lbl}</div>
                            </div>
                          )
                        )}
                      </div>
                      {dur && <DetailRow icon="⏱" label="Est. duration" value={`${dur} min`} />}
                    </DetailSection>

                    {/* Schedule */}
                    <DetailSection title="Schedule">
                      <DetailRow icon="📅" label="Frequency"   value={c.frequency ? c.frequency.charAt(0).toUpperCase() + c.frequency.slice(1) : "—"} />
                      <DetailRow icon="📆" label="Pref. day"   value={(c.preferred_day || c.preferredDay)?.charAt(0).toUpperCase() + (c.preferred_day || c.preferredDay || "monday").slice(1)} />
                      <DetailRow icon="🕗" label="Pref. time"  value={c.preferred_time || c.preferredTime || "Anytime"} />
                    </DetailSection>

                    {/* Notes */}
                    {(c.notes || c.access_notes || c.accessNotes) && (
                      <DetailSection title="Notes">
                        {(c.access_notes || c.accessNotes) && <DetailRow icon="🔑" label="Access" value={c.access_notes || c.accessNotes} />}
                        {c.notes && <DetailRow icon="📝" label="Notes" value={c.notes} />}
                      </DetailSection>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 12, borderTop: `1px solid ${T.borderLight}` }}>
                    <button onClick={() => { setEditingId(c.id); setExpandedId(null); }}
                      style={{ padding: "9px 18px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.text, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => navigate(`/dashboard/clients/${c.id}/floorplan`)}
                      style={{ padding: "9px 18px", borderRadius: T.radiusSm, border: "none", background: hasFloorPlan ? T.primaryLight : T.blueLight, color: hasFloorPlan ? T.primaryDark : T.blue, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                    >
                      🧱 {hasFloorPlan ? "View Floor Plan" : "Create Floor Plan"}
                    </button>
                    {c.phone && (
                      <a href={`tel:${c.phone}`} style={{ padding: "9px 18px", borderRadius: T.radiusSm, border: "none", background: T.primaryLight, color: T.primaryDark, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                        📞 Call
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} style={{ padding: "9px 18px", borderRadius: T.radiusSm, border: "none", background: T.blueLight, color: T.blue, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                        📧 Email
                      </a>
                    )}
                    {c.address && (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`}
                        target="_blank" rel="noreferrer"
                        style={{ padding: "9px 18px", borderRadius: T.radiusSm, border: "none", background: T.blueLight, color: T.blue, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                        🗺️ Maps
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div style={{ textAlign: "center", padding: 60, background: "#fff", borderRadius: T.radius, boxShadow: T.shadow }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>👥</div>
            <div style={{ fontWeight: 700, color: T.text, marginBottom: 6 }}>
              {clientSearch || activeFilters > 0 ? "No clients match your search" : "No clients yet"}
            </div>
            <div style={{ fontSize: 13, color: T.textMuted }}>
              {clientSearch || activeFilters > 0
                ? "Try adjusting your search or filters"
                : "Click \"+ Add Client\" above, or load demo data from the Calendar tab"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Detail sub-components ─────────────────────────────────
function DetailSection({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function DetailRow({ icon, label, value, color }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 11, color: T.textMuted }}>{label}: </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: color || T.text, wordBreak: "break-word" }}>{value}</span>
      </div>
    </div>
  );
}

function FSelect({ label, value, onChange, options }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, marginBottom: 4 }}>{label.toUpperCase()}</div>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ padding: "8px 10px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, fontSize: 13, color: T.text, background: "#fff", cursor: "pointer" }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// CLIENT FORM (Add + Edit)
// ══════════════════════════════════════════════════════════
function ClientForm({ client, settings, onSave, onDelete, onClose, isNew, isMobile }) {
  const [local, setLocal] = useState({
    name:           client.name           || "",
    email:          client.email          || "",
    phone:          client.phone          || "",
    address:        client.address        || "",
    suburb:         client.suburb         || SERVICED_AREAS[0],
    bedrooms:       client.bedrooms       ?? 3,
    bathrooms:      client.bathrooms      ?? 2,
    living:         client.living         ?? 1,
    kitchen:        client.kitchen        ?? 1,
    frequency:      client.frequency      || "fortnightly",
    preferred_day:  client.preferred_day  || client.preferredDay  || "monday",
    preferred_time: client.preferred_time || client.preferredTime || "anytime",
    custom_duration:client.custom_duration || client.customDuration || null,
    notes:          client.notes          || "",
    access_notes:   client.access_notes   || client.accessNotes   || "",
    status:         client.status         || "active",
  });

  const u = (k, v) => setLocal(p => ({ ...p, [k]: v }));
  const [touched, setTouched] = useState({});
  const touch = k => setTouched(p => ({ ...p, [k]: true }));

  const errors = {
    name:  touched.name  && !local.name.trim()                   ? "Name is required" : "",
    email: touched.email && local.email && !isEmail(local.email) ? "Invalid email"    : "",
    phone: touched.phone && local.phone && !isPhone(local.phone) ? "Invalid phone"    : "",
  };
  const canSave = local.name.trim() && (!local.email || isEmail(local.email)) && (!local.phone || isPhone(local.phone));

  const estDur = calculateDuration
    ? calculateDuration(local, settings)
    : (local.bedrooms * 25 + local.bathrooms * 30 + local.living * 20 + local.kitchen * 25 + 30);

  return (
    <div style={{ background: "#fff", borderRadius: T.radius, border: `2px solid ${T.primary}`, padding: isMobile ? 16 : 24, marginBottom: 12, boxShadow: T.shadowMd }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: T.text }}>{isNew ? "➕ New Client" : `✏️ Edit: ${client.name}`}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: T.textMuted, lineHeight: 1 }}>✕</button>
      </div>

      {/* Contact */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
        <div>
          <FLabel>FULL NAME *</FLabel>
          <input value={local.name} onChange={e => u("name", e.target.value)} onBlur={() => touch("name")} placeholder="e.g. Sarah Mitchell"
            style={{ ...inp, borderColor: errors.name ? T.danger : T.border }} />
          {errors.name && <p style={errorStyle}>{errors.name}</p>}
        </div>
        <div>
          <FLabel>SUBURB</FLabel>
          <select value={local.suburb} onChange={e => u("suburb", e.target.value)} style={inp}>
            {SERVICED_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div style={{ gridColumn: isMobile ? "1" : "1 / -1" }}>
          <FLabel>FULL ADDRESS <span style={{ fontWeight: 400, color: T.textMuted }}>(used for Google Maps routing)</span></FLabel>
          <input value={local.address} onChange={e => u("address", e.target.value)} placeholder="e.g. 23 Smith St, Buderim QLD 4556" style={inp} />
        </div>

        <div>
          <FLabel>EMAIL</FLabel>
          <input type="email" value={local.email} onChange={e => u("email", e.target.value)} onBlur={() => touch("email")} placeholder="sarah@email.com"
            style={{ ...inp, borderColor: errors.email ? T.danger : T.border }} />
          {errors.email && <p style={errorStyle}>{errors.email}</p>}
        </div>
        <div>
          <FLabel>PHONE</FLabel>
          <input type="tel" value={local.phone} onChange={e => u("phone", e.target.value)} onBlur={() => touch("phone")} placeholder="0412 345 678"
            style={{ ...inp, borderColor: errors.phone ? T.danger : T.border }} />
          {errors.phone && <p style={errorStyle}>{errors.phone}</p>}
        </div>
      </div>

      {/* Rooms */}
      <div style={{ marginTop: 16 }}>
        <FLabel>HOUSE ROOMS</FLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[["bedrooms", "🛏 Bed"], ["bathrooms", "🚿 Bath"], ["living", "🛋 Living"], ["kitchen", "🍳 Kitchen"]].map(([key, label]) => (
            <div key={key} style={{ background: T.bg, borderRadius: T.radiusSm, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6 }}>{label}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <button onClick={() => u(key, Math.max(0, local[key] - 1))}
                  style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${T.border}`, background: "#fff", cursor: "pointer", fontSize: 14, color: T.textMuted }}>−</button>
                <span style={{ fontWeight: 800, color: T.text, minWidth: 18, textAlign: "center" }}>{local[key]}</span>
                <button onClick={() => u(key, local[key] + 1)}
                  style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${T.primary}`, background: T.primaryLight, cursor: "pointer", fontSize: 14, color: T.primary }}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Schedule */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 12, marginTop: 16 }}>
        <div>
          <FLabel>FREQUENCY</FLabel>
          <select value={local.frequency} onChange={e => u("frequency", e.target.value)} style={inp}>
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Fortnightly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div>
          <FLabel>PREFERRED DAY</FLabel>
          <select value={local.preferred_day} onChange={e => u("preferred_day", e.target.value)} style={inp}>
            {["monday","tuesday","wednesday","thursday","friday"].map(d => (
              <option key={d} value={d}>{d.charAt(0).toUpperCase()+d.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <FLabel>PREFERRED TIME</FLabel>
          <select value={local.preferred_time} onChange={e => u("preferred_time", e.target.value)} style={inp}>
            <option value="anytime">Anytime</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
          </select>
        </div>
      </div>

      {/* Duration */}
      <div style={{ marginTop: 14, padding: "12px 14px", background: T.bg, borderRadius: T.radiusSm, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Estimated duration: {estDur} mins</div>
          <div style={{ fontSize: 11, color: T.textMuted }}>Calculated from room counts. Override if needed.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: T.textMuted }}>Override:</span>
          <input type="number" value={local.custom_duration || ""} onChange={e => u("custom_duration", e.target.value ? Number(e.target.value) : null)}
            placeholder={String(estDur)} style={{ width: 72, padding: "7px 10px", borderRadius: 6, border: `1.5px solid ${T.border}`, fontSize: 13, textAlign: "center" }} />
          <span style={{ fontSize: 11, color: T.textMuted }}>min</span>
        </div>
      </div>

      {/* Notes */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div>
          <FLabel>🔑 ACCESS DETAILS</FLabel>
          <textarea value={local.access_notes} onChange={e => u("access_notes", e.target.value)}
            placeholder="e.g. Key under doormat, alarm code 1234, side gate code…" rows={3}
            style={{ ...inp, resize: "vertical", height: "auto", lineHeight: 1.5 }} />
        </div>
        <div>
          <FLabel>📝 SPECIAL NOTES</FLabel>
          <textarea value={local.notes} onChange={e => u("notes", e.target.value)}
            placeholder="e.g. Has 2 dogs – keep gate closed, baby naps 1–3pm…" rows={3}
            style={{ ...inp, resize: "vertical", height: "auto", lineHeight: 1.5 }} />
        </div>
      </div>

      {/* Status (edit only) */}
      {!isNew && (
        <div style={{ marginTop: 14 }}>
          <FLabel>STATUS</FLabel>
          <div style={{ display: "flex", gap: 8 }}>
            {["active","paused","cancelled"].map(s => (
              <button key={s} onClick={() => u("status", s)}
                style={{ padding: "8px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${local.status === s ? T.primary : T.border}`, background: local.status === s ? T.primaryLight : "#fff", color: local.status === s ? T.primaryDark : T.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        {onDelete && (
          <button onClick={onDelete}
            style={{ padding: "11px 16px", borderRadius: T.radiusSm, border: "none", background: T.dangerLight, color: T.danger, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            🗑️ Delete
          </button>
        )}
        <button onClick={onClose}
          style={{ padding: "11px 18px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Cancel
        </button>
        <button
          onClick={() => { setTouched({ name: true, email: true, phone: true }); if (canSave) onSave(local); }}
          disabled={!canSave}
          style={{ flex: 1, padding: "11px", borderRadius: T.radiusSm, border: "none", background: canSave ? T.primary : T.border, color: "#fff", fontSize: 14, fontWeight: 800, cursor: canSave ? "pointer" : "not-allowed" }}>
          {isNew ? "✅ Add Client" : "✅ Save Changes"}
        </button>
      </div>
    </div>
  );
}

function FLabel({ children }) {
  return <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.6 }}>{children}</label>;
}

const inp = { width: "100%", padding: "11px 13px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14, color: T.text, boxSizing: "border-box", background: "#fff" };
