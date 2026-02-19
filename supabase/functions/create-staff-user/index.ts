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
    // Verify caller is an authenticated admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Use service role client — bypasses RLS, can verify any user JWT
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Extract the JWT and verify it
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user: callerUser }, error: callerError } = await adminClient.auth.getUser(jwt);

    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', detail: callerError?.message ?? 'No user found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check caller has admin role in profiles (service role bypasses RLS)
    const { data: callerProfile, error: profileCheckError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (profileCheckError || callerProfile?.role !== 'admin') {
      return new Response(
        JSON.stringify({
          error: 'Only admins can create staff accounts',
          detail: profileCheckError?.message ?? `role=${callerProfile?.role}`,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { email, full_name, pin, team_id, employment_type, hourly_rate, role } = await req.json();

    if (!email || !full_name) {
      return new Response(JSON.stringify({ error: 'email and full_name are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create the auth user
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

    // Hash PIN if provided
    let pin_hash: string | null = null;
    if (pin) {
      const encoder = new TextEncoder();
      const data = encoder.encode(pin + (Deno.env.get('SUPABASE_JWT_SECRET') ?? ''));
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      pin_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Upsert the profile row
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: newUser.user!.id,
        email,
        full_name,
        role: role || 'staff',
        team_id: team_id || null,
        employment_type: employment_type || 'casual',
        hourly_rate: hourly_rate || 0,
        pin_hash,
        is_active: true,
      });

    if (profileError) {
      // Clean up auth user if profile insert failed
      await adminClient.auth.admin.deleteUser(newUser.user!.id);
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send password setup invite email
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name },
    });

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user!.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
