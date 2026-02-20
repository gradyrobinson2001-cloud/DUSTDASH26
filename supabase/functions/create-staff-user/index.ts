import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // ── 1. Verify caller has a valid session ─────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerJwt = authHeader.slice(7);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: callerUser }, error: userErr } = await adminClient.auth.getUser(callerJwt);
    if (userErr || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', detail: userErr?.message ?? 'no session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 2. Confirm admin role ───────────────────────────────────────
    const { data: callerProfile, error: profileCheckError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (profileCheckError || callerProfile?.role !== 'admin') {
      return new Response(
        JSON.stringify({
          error:  'Forbidden — admin only',
          detail: profileCheckError?.message ?? `role=${callerProfile?.role}`,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 3. Parse & validate body ──────────────────────────────────────
    const { email, full_name, pin, team_id, employment_type, hourly_rate, role, siteUrl } = await req.json();
    if (!email || !full_name) {
      return new Response(JSON.stringify({ error: 'email and full_name are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Invite user — creates auth user + sends setup email in one step ─
    const redirectBase = siteUrl || req.headers.get('origin') || supabaseUrl;
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name },
        redirectTo: `${redirectBase}/reset-password`,
      }
    );

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = inviteData.user!.id;

    // ── 5. Hash PIN if provided (bcryptjs — pure JS, no Worker needed) ───
    let pin_hash: string | null = null;
    if (pin) {
      pin_hash = bcrypt.hashSync(String(pin), 10);
    }

    // ── 6. Upsert profile row ─────────────────────────────────────────
    const { error: profileError } = await adminClient.from('profiles').upsert({
      id:              userId,
      email,
      full_name,
      role:            role || 'staff',
      team_id:         team_id || null,
      employment_type: employment_type || 'casual',
      hourly_rate:     Number(hourly_rate) || 0,
      pin_hash,
      is_active:       true,
    });

    if (profileError) {
      // Clean up: remove the auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(userId, { shouldSoftDelete: false });
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
