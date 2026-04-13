import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { email, full_name, employment_type, hourly_rate, role, siteUrl } = await req.json();
    if (!email || !full_name) {
      return new Response(JSON.stringify({ error: 'email and full_name are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Create the auth user ─────────────────────────────────────
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: { full_name },
    });
    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = newUser.user!.id;

    // ── 5. Upsert profile row ─────────────────────────────────────────
    const { error: profileError } = await adminClient.from('profiles').upsert({
      id:              userId,
      email,
      full_name,
      role:            role || 'staff',
      employment_type: employment_type || 'casual',
      hourly_rate:     Number(hourly_rate) || 0,
      is_active:       true,
    });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(userId, { shouldSoftDelete: false });
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 6. Generate invite link (email sent via EmailJS on frontend) ─
    const redirectBase = siteUrl || req.headers.get('origin') || supabaseUrl;
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: { full_name },
        redirectTo: `${redirectBase}/reset-password`,
      },
    });

    let invite_link: string | null = null;
    if (linkError) {
      console.warn('[create-staff-user] Could not generate invite link:', linkError.message);
    } else if (linkData?.properties?.action_link) {
      invite_link = linkData.properties.action_link;
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId, invite_link }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
