import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

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

    // Use service-role client to verify the caller's JWT
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
    const { email, full_name, pin, team_id, employment_type, hourly_rate, role } = await req.json();
    if (!email || !full_name) {
      return new Response(JSON.stringify({ error: 'email and full_name are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Create the auth user ───────────────────────────────────────
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 5. Hash PIN if provided (bcrypt — matches verify-staff-pin) ───
    let pin_hash: string | null = null;
    if (pin) {
      pin_hash = await bcrypt.hash(String(pin));
    }

    // ── 6. Upsert profile row ─────────────────────────────────────────
    const { error: profileError } = await adminClient.from('profiles').upsert({
      id:              newUser.user!.id,
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
      await adminClient.auth.admin.deleteUser(newUser.user!.id);
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 7. Send password-setup invite email ───────────────────────────
    await adminClient.auth.admin.inviteUserByEmail(email, { data: { full_name } });

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user!.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
