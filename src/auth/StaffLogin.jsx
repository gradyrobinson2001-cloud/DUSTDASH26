import React, { useState, useEffect } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';
import { T } from '../shared';

// Staff PIN login component — used inside CleanerPortal before auth
// Returns onAuthenticated(profile) when successful
export default function StaffLogin({ onAuthenticated, onDemoMode }) {
  const [teams,        setTeams]        = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [pin,          setPin]          = useState('');
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(true);

  // Load available staff teams from profiles
  useEffect(() => {
    async function loadTeams() {
      if (!supabaseReady) { setLoadingTeams(false); return; }
      // Staff profiles are publicly listed (team name only — no sensitive data)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, team_id')
        .eq('role', 'staff')
        .eq('is_active', true)
        .order('full_name');
      if (!error && data) setTeams(data);
      setLoadingTeams(false);
    }
    loadTeams();
  }, []);

  const handlePinInput = (digit) => {
    if (pin.length < 6) setPin(prev => prev + digit);
  };

  const handleBackspace = () => setPin(prev => prev.slice(0, -1));

  const handleSubmit = async () => {
    if (!selectedTeam) { setError('Please select your team first.'); return; }
    if (pin.length < 4) { setError('PIN must be at least 4 digits.'); return; }
    setLoading(true);
    setError('');

    if (!supabaseReady) {
      // Dev fallback: accept PIN "1234"
      if (pin === '1234') {
        onAuthenticated({ id: 'dev', full_name: selectedTeam.full_name, team_id: selectedTeam.team_id, role: 'staff' });
      } else {
        setError('Incorrect PIN. (Dev mode: use 1234)');
        setPin('');
      }
      setLoading(false);
      return;
    }

    try {
      // Call the Edge Function to verify PIN and get session tokens
      const { data, error } = await supabase.functions.invoke('verify-staff-pin', {
        body: { staffId: selectedTeam.id, pin },
      });

      if (error || !data?.access_token) {
        setError('Incorrect PIN. Please try again.');
        setPin('');
        setLoading(false);
        return;
      }

      // Set the session
      await supabase.auth.setSession({
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
      });

      // Fetch full profile
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', selectedTeam.id)
        .single();

      onAuthenticated(prof);
    } catch (err) {
      setError('Login failed. Please try again.');
      setPin('');
    }
    setLoading(false);
  };

  const PinDot = ({ filled }) => (
    <div style={{ width: 14, height: 14, borderRadius: '50%', background: filled ? T.primary : 'transparent', border: `2px solid ${filled ? T.primary : T.border}`, transition: 'all 0.15s' }} />
  );

  const PadBtn = ({ label, onClick, style = {} }) => (
    <button
      onClick={onClick}
      style={{ padding: '16px', borderRadius: 12, background: T.card, border: `1px solid ${T.border}`, color: T.text, fontSize: 20, fontWeight: 600, cursor: 'pointer', transition: 'background 0.1s', ...style }}
      onMouseDown={e => e.currentTarget.style.background = T.border}
      onMouseUp={e => e.currentTarget.style.background = T.card}
    >
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: T.card, borderRadius: 16, padding: 32, width: '100%', maxWidth: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🫧</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text }}>Staff Portal</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Select your team and enter your PIN</div>
        </div>

        {/* Team selector */}
        {loadingTeams ? (
          <div style={{ textAlign: 'center', color: T.textMuted, padding: 16, fontSize: 14 }}>Loading teams…</div>
        ) : teams.length === 0 ? (
          <div style={{ textAlign: 'center', color: T.textMuted, padding: 16, fontSize: 13 }}>
            No staff accounts found.<br />
            <a href="/login" style={{ color: T.primary }}>Admin login →</a>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {teams.map(t => (
              <button
                key={t.id}
                onClick={() => { setSelectedTeam(t); setPin(''); setError(''); }}
                style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: `2px solid ${selectedTeam?.id === t.id ? T.primary : T.border}`, background: selectedTeam?.id === t.id ? T.primaryLight || '#1a2a3a' : T.bg, color: T.text, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              >
                {t.full_name}
              </button>
            ))}
          </div>
        )}

        {/* PIN display */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
          {[0,1,2,3,4,5].map(i => <PinDot key={i} filled={i < pin.length} />)}
        </div>

        {/* Numpad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {[1,2,3,4,5,6,7,8,9].map(d => (
            <PadBtn key={d} label={d} onClick={() => handlePinInput(String(d))} />
          ))}
          <PadBtn label="⌫" onClick={handleBackspace} style={{ color: T.textMuted }} />
          <PadBtn label="0" onClick={() => handlePinInput('0')} />
          <PadBtn
            label={loading ? '…' : '→'}
            onClick={handleSubmit}
            style={{ background: T.primary, color: '#fff', border: 'none' }}
          />
        </div>

        {error && (
          <div style={{ textAlign: 'center', color: '#D4645C', fontSize: 13, marginBottom: 12 }}>{error}</div>
        )}

        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <button
            onClick={onDemoMode}
            style={{ background: 'none', border: 'none', color: T.textMuted, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Demo mode
          </button>
          <span style={{ color: T.border, margin: '0 8px' }}>·</span>
          <a href="/login" style={{ color: T.textMuted, fontSize: 12 }}>Admin →</a>
        </div>
      </div>
    </div>
  );
}
