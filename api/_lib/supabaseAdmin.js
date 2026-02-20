import { createClient } from "@supabase/supabase-js";

function env(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return "";
}

const SUPABASE_URL = env("SUPABASE_URL", "VITE_SUPABASE_URL");
const SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");

export function getAdminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Server is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

