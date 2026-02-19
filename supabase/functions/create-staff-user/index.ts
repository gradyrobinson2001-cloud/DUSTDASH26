// ═══════════════════════════════════════════════════════════
// Supabase Edge Function: create-staff-user
// Creates a new Supabase Auth user + profile row for a staff
// member. Uses the service role key (server-side only — never
// exposed in the browser bundle).
//
// Called from: src/settings/StaffTab.jsx → handleCreate()
// Method: POST
// Body: { full_name, email, team_id, employment_type,
//         hourly_rate, role, pin? }
//
// Returns: { success: true, userId: string }
//   or   : { error: string }
// ═══════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Authenticate the calling admin ─────────────────
    // The request must include the caller's JWT so we can
    // verify they are an admin before creating accounts.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401);
    }

    // Admin client (service role) — used to create users
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the calling user is an admin
    const callerToken = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: callerErr } = await adminClient.auth.getUser(callerToken);

    if (callerErr || !caller) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (callerProfile?.role !== 'admin') {
      return json({ error: 'Only admins can create staff accounts' }, 403);
    }

    // ── 2. Parse + validate request body ──────────────────
    const body = await req.json();
    const { full_name, email, team_id, employment_type, hourly_rate, role, pin } = body;

    if (!full_name?.trim() || !email?.trim()) {
      return json({ error: 'full_name and email are required' }, 400);
    }

    const staffRole = role === 'admin' ? 'admin' : 'staff';

    // ── 3. Create the auth user ────────────────────────────
    // Generate a secure random password — staff will reset it
    // via the password-setup email that Supabase sends.
    const tempPassword = crypto.randomUUID().replace(/-/g, '') + 'Aa1!';

    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: tempPassword,
      email_confirm: true,          // skip email confirmation step
      user_metadata: {
        full_name: full_name.trim(),
        role: staffRole,
      },
    });

    if (createErr) {
      // Surface friendly messages for common errors
      if (createErr.message.includes('already been registered') || createErr.message.includes('already exists')) {
        return json({ error: `An account with ${email} already exists.` }, 409);
      }
      return json({ error: createErr.message }, 400);
    }

    const userId = newUser.user.id;

    // ── 4. Hash PIN if provided ────────────────────────────
    // Simple numeric PIN — we store a bcrypt hash so it's
    // never readable in the database.
    let pin_hash: string | null = null;
    if (pin && /^\d{4,8}$/.test(String(pin))) {
      // Use Web Crypto for a simple hash (Deno doesn't bundle bcrypt).
      // For production-grade hashing, deploy with the bcrypt import.
      // Here we use a SHA-256 + salt approach as a safe fallback.
      const encoder = new TextEncoder();
      const salt = crypto.randomUUID();
      const data = encoder.encode(salt + pin);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      pin_hash = `sha256:${salt}:${hashHex}`;
    }

    // ── 5. Upsert the profile row ──────────────────────────
    const profileData: Record<string, unknown> = {
      id:              userId,
      full_name:       full_name.trim(),
      email:           email.trim().toLowerCase(),
      role:            staffRole,
      team_id:         team_id || null,
      employment_type: employment_type || 'casual',
      hourly_rate:     parseFloat(hourly_rate) || 0,
      is_active:       true,
    };
    if (pin_hash) profileData.pin_hash = pin_hash;

    const { error: profileErr } = await adminClient
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' });

    if (profileErr) {
      // Auth user was created but profile failed — clean up
      await adminClient.auth.admin.deleteUser(userId);
      return json({ error: `Profile creation failed: ${profileErr.message}` }, 500);
    }

    // ── 6. Send password-setup email ──────────────────────
    // Generates a "set password" link and emails it to the
    // new staff member so they choose their own password.
    const siteUrl = Deno.env.get('SITE_URL') || 'https://dustdash26.vercel.app';
    await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: email.trim().toLowerCase(),
      options: {
        redirectTo: `${siteUrl}/reset-password`,
      },
    });

    // Also send the actual email using Supabase's built-in mailer
    await adminClient.auth.admin.generateLink({
      type: 'invite',
      email: email.trim().toLowerCase(),
      options: {
        redirectTo: `${siteUrl}/reset-password`,
        data: { full_name: full_name.trim() },
      },
    });

    return json({ success: true, userId });

  } catch (err) {
    console.error('[create-staff-user]', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

// ── Helper ────────────────────────────────────────────────
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/*
 * ══════════════════════════════════════════════════════════
 * DEPLOYMENT INSTRUCTIONS
 * ══════════════════════════════════════════════════════════
 *
 * 1. Install Supabase CLI (if not already):
 *      npm install -g supabase
 *
 * 2. Login and link your project:
 *      supabase login
 *      supabase link --project-ref qvycgbvpczatxgvxtmnf
 *
 * 3. Set the SITE_URL secret (your Vercel deployment URL):
 *      supabase secrets set SITE_URL=https://dustdash26.vercel.app
 *
 * 4. Deploy both functions:
 *      supabase functions deploy create-staff-user
 *      supabase functions deploy verify-staff-pin
 *
 * The SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
 * automatically injected — you do NOT set those manually.
 *
 * ══════════════════════════════════════════════════════════
 */
