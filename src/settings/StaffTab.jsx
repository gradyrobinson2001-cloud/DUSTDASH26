import React, { useState } from "react";
import emailjs from "@emailjs/browser";
import { T } from "../shared";
import { supabase, supabaseReady } from "../lib/supabase";
import { useProfiles } from "../hooks/useProfiles";

const EMAILJS_SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
// Use the universal template for staff invite emails
const EMAILJS_INVITE_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_INVITE_TEMPLATE_ID || import.meta.env.VITE_EMAILJS_UNIVERSAL_TEMPLATE_ID;

// ═══════════════════════════════════════════════════════════
// STAFF MANAGEMENT TAB — Admin Panel
// Account creation goes via the create-staff-user Edge Function
// which uses the Supabase service role key server-side.
// Password resets / magic links use the anon client directly.
// ═══════════════════════════════════════════════════════════

export default function StaffTab({ scheduleSettings, showToast, isMobile }) {
  const { profiles, staffMembers, loading, updateProfile } = useProfiles();
  const [editingId,   setEditingId]   = useState(null);
  const [resetting,   setResetting]   = useState(null);
  const [deleting,    setDeleting]    = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const teams = scheduleSettings?.teams || [
    { id: "team_a", name: "Team A", color: T.primary },
    { id: "team_b", name: "Team B", color: T.blue },
  ];

  const adminProfiles = profiles.filter(p => p.role === "admin");

  const handleResetPassword = async (email, staffId) => {
    if (!email) { showToast("⚠️ No email on file for this staff member"); return; }
    setResetting(staffId);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      showToast(`✅ Password reset email sent to ${email}`);
    } catch (e) { showToast(`❌ ${e.message}`); }
    setResetting(null);
  };

  const handleSendMagicLink = async (email, staffId) => {
    if (!email) { showToast("⚠️ No email on file"); return; }
    setResetting(staffId);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error) throw error;
      showToast(`✅ Magic login link sent to ${email}`);
    } catch (e) { showToast(`❌ ${e.message}`); }
    setResetting(null);
  };

  const handleDelete = async (staffId, name) => {
    if (!confirm(`Delete "${name}"? This removes their account and profile permanently.`)) return;
    setDeleting(staffId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/delete-staff-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ userId: staffId }),
      });
      let result;
      try { result = await res.json(); } catch { result = {}; }
      if (!res.ok || result.error) {
        showToast(`❌ ${result.error || "Failed to delete"}`);
      } else {
        showToast(`✅ ${name} deleted`);
        setEditingId(null);
      }
    } catch (e) { showToast(`❌ ${e.message}`); }
    setDeleting(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", flexDirection: isMobile ? "column" : "row", gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.text }}>👤 Staff Management</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: T.textMuted }}>{staffMembers.length} staff · {adminProfiles.length} admin</p>
        </div>
        <button onClick={() => setShowNewForm(v => !v)}
          style={{ padding: "11px 20px", borderRadius: T.radiusSm, border: "none", background: showNewForm ? "#888" : T.primary, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          {showNewForm ? "✕ Cancel" : "+ Add Staff Member"}
        </button>
      </div>

      {!supabaseReady && (
        <div style={{ padding: "12px 16px", background: T.accentLight, borderRadius: T.radiusSm, marginBottom: 16, fontSize: 13, color: "#8B6914" }}>
          ⚠️ <strong>Supabase not connected.</strong> Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.
        </div>
      )}

      {showNewForm && (
        <NewStaffForm teams={teams} onClose={() => setShowNewForm(false)}
          onCreated={(msg) => { showToast(msg); setShowNewForm(false); }} isMobile={isMobile} />
      )}

      {adminProfiles.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeader>Admin Accounts</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {adminProfiles.map(p => (
              <ProfileCard key={p.id} profile={p} teams={teams} isEditing={editingId === p.id}
                onEdit={() => setEditingId(editingId === p.id ? null : p.id)}
                onSave={async (updates) => { await updateProfile(p.id, updates); setEditingId(null); showToast("✅ Profile updated"); }}
                onResetPassword={() => handleResetPassword(p.email, p.id)}
                onMagicLink={() => handleSendMagicLink(p.email, p.id)}
                resetting={resetting === p.id} isMobile={isMobile} isAdmin />
            ))}
          </div>
        </div>
      )}

      <SectionHeader>Staff Accounts</SectionHeader>
      {loading && <div style={{ textAlign: "center", padding: 40, color: T.textMuted }}>Loading staff…</div>}
      {!loading && staffMembers.length === 0 && (
        <div style={{ background: "#fff", borderRadius: T.radius, padding: 40, textAlign: "center", boxShadow: T.shadow }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
          <div style={{ fontWeight: 700, color: T.text, marginBottom: 6 }}>No staff accounts yet</div>
          <div style={{ fontSize: 13, color: T.textMuted }}>
            Click "+ Add Staff Member" above to create a new staff account.
            They'll receive a setup email and can access the Staff Portal at <strong>/cleaner</strong>.
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {staffMembers.map(p => (
          <ProfileCard key={p.id} profile={p} teams={teams} isEditing={editingId === p.id}
            onEdit={() => setEditingId(editingId === p.id ? null : p.id)}
            onSave={async (updates) => { await updateProfile(p.id, updates); setEditingId(null); showToast("✅ Profile updated"); }}
            onResetPassword={() => handleResetPassword(p.email, p.id)}
            onMagicLink={() => handleSendMagicLink(p.email, p.id)}
            onDelete={() => handleDelete(p.id, p.full_name)}
            resetting={resetting === p.id} deleting={deleting === p.id} isMobile={isMobile} />
        ))}
      </div>

      <div style={{ marginTop: 24, padding: "14px 16px", background: T.blueLight, borderRadius: T.radius, fontSize: 13, color: T.blue }}>
        <strong>ℹ️ How staff access works</strong>
        <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 2 }}>
          <li>Staff portal: <strong>{window.location.origin}/cleaner</strong></li>
          <li>Staff log in with their name + PIN (set when you create their account)</li>
          <li>Use <strong>"Send Password Reset"</strong> if they forget their password</li>
          <li>Use <strong>"Send Magic Link"</strong> for instant passwordless access</li>
        </ul>
      </div>
    </div>
  );
}

function SectionHeader({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 800, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>{children}</div>;
}

// ══════════════════════════════════════════════════════════
// PROFILE CARD
// ══════════════════════════════════════════════════════════
function ProfileCard({ profile: p, teams, isEditing, onEdit, onSave, onResetPassword, onMagicLink, onDelete, resetting, deleting, isMobile, isAdmin }) {
  const [local, setLocal] = useState({
    full_name: p.full_name || "", team_id: p.team_id || "",
    hourly_rate: p.hourly_rate || 0, employment_type: p.employment_type || "casual", is_active: p.is_active ?? true,
  });
  const u = (k, v) => setLocal(prev => ({ ...prev, [k]: v }));
  const team = teams.find(t => t.id === p.team_id);

  return (
    <div style={{ background: "#fff", borderRadius: T.radius, overflow: "hidden", boxShadow: T.shadow, border: `1px solid ${isEditing ? T.primary : T.border}` }}>
      <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, background: isAdmin ? T.accentLight : `linear-gradient(135deg, ${team?.color || T.primary}, ${T.blue})`, color: isAdmin ? "#8B6914" : "#fff" }}>
          {(p.full_name || "?").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: T.text }}>{p.full_name || "(No name)"}</span>
            <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: isAdmin ? T.accentLight : T.primaryLight, color: isAdmin ? "#8B6914" : T.primaryDark }}>
              {isAdmin ? "Admin" : "Staff"}
            </span>
            {!p.is_active && <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: T.dangerLight, color: T.danger }}>Inactive</span>}
          </div>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
            {p.email || "No email"}
            {team && <span style={{ marginLeft: 8, color: team.color, fontWeight: 600 }}>· {team.name}</span>}
            {p.employment_type && <span style={{ marginLeft: 8 }}>· {p.employment_type.charAt(0).toUpperCase() + p.employment_type.slice(1)}</span>}
            {p.hourly_rate > 0 && <span style={{ marginLeft: 8 }}>· ${Number(p.hourly_rate).toFixed(2)}/hr</span>}
          </div>
        </div>
        <button onClick={onEdit}
          style={{ padding: "7px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${isEditing ? T.primary : T.border}`, background: isEditing ? T.primaryLight : "#fff", color: isEditing ? T.primaryDark : T.text, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {isEditing ? "Cancel" : "✏️ Edit"}
        </button>
      </div>

      {isEditing && (
        <div style={{ padding: "16px 18px", borderTop: `1px solid ${T.border}`, background: T.bg }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <SFLabel>FULL NAME</SFLabel>
              <input value={local.full_name} onChange={e => u("full_name", e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14, boxSizing: "border-box" }} />
            </div>
            {!isAdmin && <>
              <div>
                <SFLabel>TEAM</SFLabel>
                <select value={local.team_id} onChange={e => u("team_id", e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
                  <option value="">No team</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <SFLabel>EMPLOYMENT TYPE</SFLabel>
                <select value={local.employment_type} onChange={e => u("employment_type", e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
                  <option value="casual">Casual</option>
                  <option value="part_time">Part Time</option>
                  <option value="full_time">Full Time</option>
                </select>
              </div>
              <div>
                <SFLabel>HOURLY RATE ($/hr)</SFLabel>
                <input type="number" min="0" step="0.50" value={local.hourly_rate} onChange={e => u("hourly_rate", parseFloat(e.target.value) || 0)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14, boxSizing: "border-box" }} />
              </div>
            </>}
          </div>
          {!isAdmin && (
            <div style={{ marginBottom: 14 }}>
              <SFLabel>ACTIVE STATUS</SFLabel>
              <div style={{ display: "flex", gap: 8 }}>
                {[true, false].map(v => (
                  <button key={String(v)} onClick={() => u("is_active", v)}
                    style={{ padding: "8px 16px", borderRadius: T.radiusSm, border: `1.5px solid ${local.is_active === v ? T.primary : T.border}`, background: local.is_active === v ? T.primaryLight : "#fff", color: local.is_active === v ? T.primaryDark : T.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {v ? "Active" : "Inactive"}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => onSave(local)}
              style={{ padding: "10px 20px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              ✅ Save Changes
            </button>
            <button onClick={onEdit}
              style={{ padding: "10px 16px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {p.email && (
        <div style={{ padding: "10px 18px", borderTop: `1px solid ${T.border}`, background: "#FAFCFB", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: T.textMuted, marginRight: 4 }}>Auth actions:</span>
          <button onClick={onResetPassword} disabled={!!resetting}
            style={{ padding: "6px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.text, fontSize: 12, fontWeight: 600, cursor: resetting ? "not-allowed" : "pointer", opacity: resetting ? 0.6 : 1 }}>
            {resetting ? "Sending…" : "📧 Send Password Reset"}
          </button>
          <button onClick={onMagicLink} disabled={!!resetting}
            style={{ padding: "6px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.blue, fontSize: 12, fontWeight: 600, cursor: resetting ? "not-allowed" : "pointer", opacity: resetting ? 0.6 : 1 }}>
            ✨ Send Magic Link
          </button>
          {!isAdmin && onDelete && (
            <button onClick={onDelete} disabled={!!deleting}
              style={{ padding: "6px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.danger || "#D4645C"}`, background: "#fff", color: T.danger || "#D4645C", fontSize: 12, fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1, marginLeft: "auto" }}>
              {deleting ? "Deleting…" : "🗑 Delete"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// NEW STAFF FORM — calls the create-staff-user Edge Function
// ══════════════════════════════════════════════════════════
function NewStaffForm({ teams, onClose, onCreated, isMobile }) {
  const [form, setForm] = useState({
    full_name: "", email: "", pin: "",
    team_id: teams[0]?.id || "", employment_type: "casual", hourly_rate: "", role: "staff",
  });
  const [creating, setCreating] = useState(false);
  const [error,    setError]    = useState("");
  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleCreate = async () => {
    setError("");
    if (!form.full_name.trim()) { setError("Full name is required"); return; }
    if (!form.email.trim())     { setError("Email address is required"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError("Please enter a valid email address"); return; }
    if (form.pin && !/^\d{4,8}$/.test(form.pin)) { setError("PIN must be 4–8 digits (numbers only)"); return; }
    if (!supabaseReady) { setError("Supabase is not connected. Check your environment variables."); return; }

    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("You must be signed in as an admin to create accounts.");
        setCreating(false);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/create-staff-user`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey":        import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          full_name:       form.full_name.trim(),
          email:           form.email.trim().toLowerCase(),
          pin:             form.pin || undefined,
          team_id:         form.team_id || null,
          employment_type: form.employment_type,
          hourly_rate:     parseFloat(form.hourly_rate) || 0,
          role:            form.role,
          siteUrl:         window.location.origin,
        }),
      });

      let result;
      try { result = await res.json(); } catch { result = {}; }

      if (!res.ok || result.error) {
        if (res.status === 404 || String(result.error || "").includes("not found")) {
          setError("DEPLOY_NEEDED");
        } else {
          setError(result.error || result.detail || `Server error (${res.status})`);
        }
        setCreating(false);
        return;
      }

      // Send invite email via EmailJS (bypasses Supabase email rate limits)
      if (result.invite_link && EMAILJS_SERVICE_ID && EMAILJS_INVITE_TEMPLATE_ID) {
        try {
          await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_INVITE_TEMPLATE_ID, {
            to_email:    form.email.trim().toLowerCase(),
            to_name:     form.full_name.trim(),
            subject:     "You've been invited to Dust Bunnies",
            message:     `Hi ${form.full_name.trim()},\n\nYou've been added as a staff member at Dust Bunnies. Click the link below to set up your password and get started:\n\n${result.invite_link}\n\nThis link will expire in 24 hours.\n\nCheers,\nDust Bunnies Admin`,
            invite_link: result.invite_link,
          }, EMAILJS_PUBLIC_KEY);
        } catch (emailErr) {
          console.warn("EmailJS invite failed:", emailErr);
          // Account still created — just warn
        }
      }

      onCreated(`✅ ${form.full_name} created!${result.invite_link ? " A setup email has been sent to " + form.email + "." : " Account ready (no email sent — configure EmailJS)."}`);
    } catch (e) {
      if (e.message.includes("Failed to fetch") || e.message.includes("NetworkError")) {
        setError("DEPLOY_NEEDED");
      } else {
        setError(e.message || "Failed to create account");
      }
    }
    setCreating(false);
  };

  return (
    <div style={{ background: "#fff", borderRadius: T.radius, border: `2px solid ${T.primary}`, padding: isMobile ? 16 : 24, marginBottom: 16, boxShadow: T.shadow }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: T.text }}>➕ New Staff Account</div>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: T.textMuted }}>✕</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
        <div>
          <SFLabel>FULL NAME *</SFLabel>
          <input value={form.full_name} onChange={e => u("full_name", e.target.value)} placeholder="e.g. Emma Johnson"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14, boxSizing: "border-box" }} />
        </div>
        <div>
          <SFLabel>EMAIL ADDRESS *</SFLabel>
          <input type="email" value={form.email} onChange={e => u("email", e.target.value)} placeholder="emma@example.com"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14, boxSizing: "border-box" }} />
        </div>
        <div>
          <SFLabel>STAFF PORTAL PIN (4–8 digits)</SFLabel>
          <input type="password" inputMode="numeric" value={form.pin} onChange={e => u("pin", e.target.value.replace(/\D/g, ""))} placeholder="e.g. 1234" maxLength={8}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14, boxSizing: "border-box" }} />
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 3 }}>Used to log in to the /cleaner portal. Leave blank to set later.</div>
        </div>
        <div>
          <SFLabel>TEAM</SFLabel>
          <select value={form.team_id} onChange={e => u("team_id", e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
            <option value="">No team</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <SFLabel>ROLE</SFLabel>
          <select value={form.role} onChange={e => u("role", e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <SFLabel>EMPLOYMENT TYPE</SFLabel>
          <select value={form.employment_type} onChange={e => u("employment_type", e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
            <option value="casual">Casual</option>
            <option value="part_time">Part Time</option>
            <option value="full_time">Full Time</option>
          </select>
        </div>
        <div>
          <SFLabel>HOURLY RATE ($/hr)</SFLabel>
          <input type="number" min="0" step="0.50" value={form.hourly_rate} onChange={e => u("hourly_rate", e.target.value)} placeholder="e.g. 28.00"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14, boxSizing: "border-box" }} />
        </div>
      </div>

      {error === "DEPLOY_NEEDED" ? (
        <div style={{ padding: "12px 14px", background: "#FFF8E7", border: "1px solid #F5A623", borderRadius: T.radiusSm, fontSize: 13, color: "#7A5200", marginBottom: 14 }}>
          <strong>⚡ One-time setup needed: Deploy the Edge Function</strong>
          <p style={{ margin: "6px 0 4px" }}>Account creation requires a secure server-side function. Run these 4 commands in Terminal (takes ~2 minutes):</p>
          <div style={{ background: "#1a1a1a", color: "#a8ff78", borderRadius: 6, padding: "10px 14px", fontFamily: "monospace", fontSize: 12, lineHeight: 1.9 }}>
            npm install -g supabase<br/>
            supabase login<br/>
            supabase link --project-ref qvycgbvpczatxgvxtmnf<br/>
            supabase functions deploy create-staff-user
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 12 }}>After deploying, click "Create Account" again — it'll work immediately.</p>
        </div>
      ) : error ? (
        <div style={{ padding: "10px 14px", background: T.dangerLight, borderRadius: T.radiusSm, color: T.danger, fontSize: 13, marginBottom: 14 }}>
          ⚠️ {error}
        </div>
      ) : null}

      <div style={{ padding: "10px 14px", background: T.blueLight, borderRadius: T.radiusSm, marginBottom: 14, fontSize: 12, color: T.blue }}>
        📧 A password setup email will be sent automatically so the staff member can set their own password.
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose}
          style={{ padding: "10px 16px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Cancel
        </button>
        <button onClick={handleCreate} disabled={creating || !form.email.trim() || !form.full_name.trim()}
          style={{ flex: 1, padding: "10px", borderRadius: T.radiusSm, border: "none", background: (!form.email.trim() || !form.full_name.trim()) ? T.border : T.primary, color: "#fff", fontSize: 14, fontWeight: 800, cursor: (creating || !form.email.trim() || !form.full_name.trim()) ? "not-allowed" : "pointer", opacity: creating ? 0.7 : 1 }}>
          {creating ? "Creating account…" : "✅ Create Account & Send Email"}
        </button>
      </div>
    </div>
  );
}

function SFLabel({ children }) {
  return <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</label>;
}
