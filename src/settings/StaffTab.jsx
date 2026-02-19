import React, { useState } from "react";
import { T } from "../shared";
import { supabase, supabaseReady } from "../lib/supabase";
import { useProfiles } from "../hooks/useProfiles";

// ═══════════════════════════════════════════════════════════
// STAFF MANAGEMENT TAB — Admin Panel
// Create staff accounts, edit profiles, reset passwords
// Send password reset / magic link via Supabase Auth
// ═══════════════════════════════════════════════════════════

export default function StaffTab({ scheduleSettings, showToast, isMobile }) {
  const { profiles, staffMembers, loading, updateProfile } = useProfiles();
  const [creating,  setCreating]  = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [resetting, setResetting] = useState(null); // staffId | null
  const [showNewForm, setShowNewForm] = useState(false);

  const teams = scheduleSettings?.teams || [
    { id: "team_a", name: "Team A", color: T.primary },
    { id: "team_b", name: "Team B", color: T.blue },
  ];

  const allProfiles = profiles; // includes admin
  const adminProfiles = allProfiles.filter(p => p.role === "admin");

  const handleResetPassword = async (email, staffId) => {
    if (!email) { showToast("No email on file for this staff member"); return; }
    if (!supabaseReady) { showToast("Supabase not connected — cannot send reset email"); return; }
    setResetting(staffId);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      showToast(`✅ Password reset email sent to ${email}`);
    } catch (e) {
      showToast(`❌ Failed: ${e.message}`);
    }
    setResetting(null);
  };

  const handleSendMagicLink = async (email, staffId) => {
    if (!email) { showToast("No email on file"); return; }
    if (!supabaseReady) { showToast("Supabase not connected"); return; }
    setResetting(staffId);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      showToast(`✅ Magic login link sent to ${email}`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
    setResetting(null);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center", flexDirection: isMobile ? "column" : "row", gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.text }}>👤 Staff Management</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: T.textMuted }}>
            {staffMembers.length} staff · {adminProfiles.length} admin
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(v => !v)}
          style={{ padding: "11px 20px", borderRadius: T.radiusSm, border: "none", background: T.primary, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
        >
          + Add Staff Member
        </button>
      </div>

      {/* Supabase warning */}
      {!supabaseReady && (
        <div style={{ padding: "12px 16px", background: T.accentLight, borderRadius: T.radiusSm, marginBottom: 16, fontSize: 13, color: "#8B6914" }}>
          ⚠️ <strong>Supabase not connected.</strong> Staff account creation and password resets require Supabase. Add your environment variables to enable this.
        </div>
      )}

      {/* New staff form */}
      {showNewForm && (
        <NewStaffForm
          teams={teams}
          onClose={() => setShowNewForm(false)}
          onCreated={(msg) => { showToast(msg); setShowNewForm(false); }}
          isMobile={isMobile}
        />
      )}

      {/* Admin accounts section */}
      {adminProfiles.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <SectionHeader>Admin Accounts</SectionHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {adminProfiles.map(p => (
              <ProfileCard
                key={p.id}
                profile={p}
                teams={teams}
                isEditing={editingId === p.id}
                onEdit={() => setEditingId(editingId === p.id ? null : p.id)}
                onSave={async (updates) => { await updateProfile(p.id, updates); setEditingId(null); showToast("✅ Profile updated"); }}
                onResetPassword={() => handleResetPassword(p.email, p.id)}
                onMagicLink={() => handleSendMagicLink(p.email, p.id)}
                resetting={resetting === p.id}
                isMobile={isMobile}
                isAdmin
              />
            ))}
          </div>
        </div>
      )}

      {/* Staff accounts */}
      <SectionHeader>Staff Accounts</SectionHeader>

      {loading && <div style={{ textAlign: "center", padding: 40, color: T.textMuted }}>Loading staff…</div>}

      {!loading && staffMembers.length === 0 && (
        <div style={{ background: "#fff", borderRadius: T.radius, padding: 40, textAlign: "center", boxShadow: T.shadow }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
          <div style={{ fontWeight: 700, color: T.text, marginBottom: 6 }}>No staff accounts yet</div>
          <div style={{ fontSize: 13, color: T.textMuted }}>
            Click "+ Add Staff Member" above to create a new staff account. They'll receive a login email and can access the Staff Portal at <strong>/cleaner</strong>.
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {staffMembers.map(p => (
          <ProfileCard
            key={p.id}
            profile={p}
            teams={teams}
            isEditing={editingId === p.id}
            onEdit={() => setEditingId(editingId === p.id ? null : p.id)}
            onSave={async (updates) => { await updateProfile(p.id, updates); setEditingId(null); showToast("✅ Profile updated"); }}
            onResetPassword={() => handleResetPassword(p.email, p.id)}
            onMagicLink={() => handleSendMagicLink(p.email, p.id)}
            resetting={resetting === p.id}
            isMobile={isMobile}
          />
        ))}
      </div>

      {/* Instructions */}
      <div style={{ marginTop: 24, padding: "14px 16px", background: T.blueLight, borderRadius: T.radius, fontSize: 13, color: T.blue }}>
        <strong>ℹ️ How staff login works:</strong>
        <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 2 }}>
          <li>Staff go to <strong>{window.location.origin}/cleaner</strong></li>
          <li>They select their name and enter their 6-digit PIN</li>
          <li>PIN is set via Supabase Dashboard → Authentication → Users → their profile</li>
          <li>Use "Send Reset Email" below to let them set a new password for admin access</li>
        </ul>
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────
function SectionHeader({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 800, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>{children}</div>;
}

// ══════════════════════════════════════════════════════════
// PROFILE CARD
// ══════════════════════════════════════════════════════════
function ProfileCard({ profile: p, teams, isEditing, onEdit, onSave, onResetPassword, onMagicLink, resetting, isMobile, isAdmin }) {
  const [local, setLocal] = useState({
    full_name:       p.full_name || "",
    team_id:         p.team_id || "",
    hourly_rate:     p.hourly_rate || 0,
    employment_type: p.employment_type || "casual",
    is_active:       p.is_active ?? true,
    pin_hint:        "", // never pre-filled for security
  });

  const u = (k, v) => setLocal(prev => ({ ...prev, [k]: v }));
  const team = teams.find(t => t.id === p.team_id);

  return (
    <div style={{ background: "#fff", borderRadius: T.radius, overflow: "hidden", boxShadow: T.shadow, border: `1px solid ${isEditing ? T.primary : T.border}` }}>
      {/* Summary */}
      <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: isAdmin ? T.accentLight : `linear-gradient(135deg, ${team?.color || T.primary}, ${T.blue})`, display: "flex", alignItems: "center", justifyContent: "center", color: isAdmin ? "#8B6914" : "#fff", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
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
            {p.hourly_rate > 0 && <span style={{ marginLeft: 8 }}>· ${p.hourly_rate}/hr</span>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          <button onClick={onEdit}
            style={{ padding: "7px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${isEditing ? T.primary : T.border}`, background: isEditing ? T.primaryLight : "#fff", color: isEditing ? T.primaryDark : T.text, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {isEditing ? "Cancel" : "✏️ Edit"}
          </button>
        </div>
      </div>

      {/* Edit form */}
      {isEditing && (
        <div style={{ padding: "16px 18px", borderTop: `1px solid ${T.border}`, background: T.bg }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <SFLabel>FULL NAME</SFLabel>
              <input value={local.full_name} onChange={e => u("full_name", e.target.value)}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14, boxSizing: "border-box" }} />
            </div>

            {!isAdmin && (
              <div>
                <SFLabel>TEAM</SFLabel>
                <select value={local.team_id} onChange={e => u("team_id", e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
                  <option value="">No team</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            {!isAdmin && (
              <>
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
              </>
            )}
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

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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

      {/* Auth actions */}
      {p.email && (
        <div style={{ padding: "10px 18px", borderTop: `1px solid ${T.borderLight}`, background: "#FAFCFB", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: T.textMuted, marginRight: 4 }}>Auth:</span>
          <button
            onClick={onResetPassword}
            disabled={resetting}
            style={{ padding: "6px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.text, fontSize: 12, fontWeight: 600, cursor: resetting ? "not-allowed" : "pointer", opacity: resetting ? 0.6 : 1 }}
          >
            {resetting ? "Sending…" : "📧 Send Password Reset"}
          </button>
          <button
            onClick={onMagicLink}
            disabled={resetting}
            style={{ padding: "6px 14px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.blue, fontSize: 12, fontWeight: 600, cursor: resetting ? "not-allowed" : "pointer", opacity: resetting ? 0.6 : 1 }}
          >
            ✨ Send Magic Link
          </button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// NEW STAFF FORM — creates Supabase Auth user + profile
// ══════════════════════════════════════════════════════════
function NewStaffForm({ teams, onClose, onCreated, isMobile }) {
  const [form, setForm] = useState({
    full_name:       "",
    email:           "",
    team_id:         teams[0]?.id || "",
    employment_type: "casual",
    hourly_rate:     0,
    role:            "staff",
  });
  const [creating, setCreating] = useState(false);
  const [error,    setError]    = useState("");

  const u = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleCreate = async () => {
    if (!form.email.trim() || !form.full_name.trim()) { setError("Name and email are required"); return; }
    if (!supabaseReady) {
      // Without service role, we can't create users server-side from the frontend.
      // Guide the owner to do it via Supabase dashboard instead.
      setError("Account creation requires the Supabase service role key (server-side). Please create the account manually in your Supabase Dashboard → Authentication → Users, then return here to set their team and rate.");
      return;
    }

    setCreating(true);
    setError("");

    try {
      // Try admin createUser — only works if service role is available
      // In practice this will be done via our own Edge Function
      // For now: use signUp which creates a user and sends a confirmation email
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: `TempPwd${Math.random().toString(36).slice(2, 10)}!`, // temporary — they'll reset it
        options: {
          data: {
            full_name: form.full_name.trim(),
            role: form.role,
          },
        },
      });

      if (signUpError) throw signUpError;

      // If user created, update the profile record that the trigger creates
      if (data?.user) {
        await supabase.from("profiles").upsert({
          id:              data.user.id,
          full_name:       form.full_name.trim(),
          email:           form.email.trim(),
          role:            form.role,
          team_id:         form.team_id || null,
          employment_type: form.employment_type,
          hourly_rate:     form.hourly_rate,
          is_active:       true,
        }, { onConflict: "id" });

        // Send password reset so they can set their own password
        await supabase.auth.resetPasswordForEmail(form.email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        onCreated(`✅ ${form.full_name} created! Password setup email sent to ${form.email}`);
      }
    } catch (e) {
      setError(e.message || "Failed to create account");
    }
    setCreating(false);
  };

  return (
    <div style={{ background: "#fff", borderRadius: T.radius, border: `2px solid ${T.primary}`, padding: isMobile ? 16 : 24, marginBottom: 16, boxShadow: T.shadowMd }}>
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
          <SFLabel>TEAM</SFLabel>
          <select value={form.team_id} onChange={e => u("team_id", e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14 }}>
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
          <input type="number" min="0" step="0.50" value={form.hourly_rate} onChange={e => u("hourly_rate", parseFloat(e.target.value) || 0)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.border}`, fontSize: 14, boxSizing: "border-box" }} />
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: T.dangerLight, borderRadius: T.radiusSm, color: T.danger, fontSize: 13, marginBottom: 14 }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ padding: "10px 14px", background: T.blueLight, borderRadius: T.radiusSm, marginBottom: 14, fontSize: 12, color: T.blue }}>
        📧 A password setup email will be automatically sent to the staff member after their account is created.
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose}
          style={{ padding: "10px 16px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#fff", color: T.textMuted, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Cancel
        </button>
        <button onClick={handleCreate} disabled={creating || !form.email || !form.full_name}
          style={{ flex: 1, padding: "10px", borderRadius: T.radiusSm, border: "none", background: (!form.email || !form.full_name) ? T.border : T.primary, color: "#fff", fontSize: 14, fontWeight: 800, cursor: (creating || !form.email || !form.full_name) ? "not-allowed" : "pointer", opacity: creating ? 0.7 : 1 }}>
          {creating ? "Creating…" : "✅ Create Account & Send Email"}
        </button>
      </div>
    </div>
  );
}

function SFLabel({ children }) {
  return <label style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</label>;
}
