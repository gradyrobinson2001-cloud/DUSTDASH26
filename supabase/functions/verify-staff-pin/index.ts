// Supabase Edge Function: verify-staff-pin
// Verifies a staff member's PIN (bcrypt) and returns session tokens.
// Deno runtime — no npm install needed.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3';

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
    const { staffId, pin } = await req.json();

    if (!staffId || !pin) {
      return new Response(JSON.stringify({ error: 'Missing staffId or pin' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role key (available as env var in Edge Functions)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Look up the staff profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, pin_hash, is_active, role')
      .eq('id', staffId)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Staff member not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!profile.is_active) {
      return new Response(JSON.stringify({ error: 'Account is inactive' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (profile.role !== 'staff') {
      return new Response(JSON.stringify({ error: 'Not a staff account' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!profile.pin_hash) {
      return new Response(JSON.stringify({ error: 'PIN not set for this account. Contact admin.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify PIN against bcrypt hash (bcryptjs — pure JS, no Worker needed)
    const valid = bcrypt.compareSync(pin, profile.pin_hash);

    if (!valid) {
      return new Response(JSON.stringify({ error: 'Invalid PIN' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up the staff user's email from auth.users
    const { data: { user }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(staffId);

    if (getUserError || !user) {
      return new Response(JSON.stringify({ error: 'Could not retrieve user account' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate a magic link for the staff user, then extract the token to create a session
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email!,
    });

    if (linkError || !linkData) {
      return new Response(JSON.stringify({ error: 'Could not generate session link' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use the OTP token from the generated link to verify and get a real session
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: linkData.properties?.hashed_token,
      type: 'magiclink',
    });

    if (sessionError || !sessionData?.session) {
      return new Response(JSON.stringify({ error: 'Could not create session' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return real session tokens the client can use with supabase.auth.setSession()
    return new Response(
      JSON.stringify({
        success: true,
        userId: profile.id,
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (err) {
    console.error('[verify-staff-pin] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/*
 * SETUP INSTRUCTIONS:
 *
 * 1. Install Supabase CLI: npm install -g supabase
 * 2. Login: supabase login
 * 3. Link project: supabase link --project-ref YOUR_PROJECT_REF
 * 4. Deploy: supabase functions deploy verify-staff-pin
 *
 * CREATING STAFF ACCOUNTS (run in Supabase SQL editor or admin script):
 *
 * -- 1. Create auth user for staff (do this in Supabase Auth dashboard or via admin API)
 * -- Email convention: team_a@dustbunnies.internal (internal address, never used for real emails)
 *
 * -- 2. Create profile (after auth user is created):
 * INSERT INTO profiles (id, email, full_name, role, team_id, pin_hash, hourly_rate, employment_type, is_active)
 * VALUES (
 *   'auth-user-uuid-here',
 *   'team_a@dustbunnies.internal',
 *   'Team A',
 *   'staff',
 *   'team_a',
 *   '$2a$10$...bcrypt_hash_of_pin...',  -- generate with: bcrypt.hash('1234', 10)
 *   28.00,
 *   'casual',
 *   true
 * );
 *
 * GENERATING A BCRYPT HASH FOR A PIN:
 * Run this in Node.js:
 *   const bcrypt = require('bcryptjs');
 *   console.log(bcrypt.hashSync('1234', 10));
 */
