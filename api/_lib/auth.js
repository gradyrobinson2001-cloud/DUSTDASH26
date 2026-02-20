import { ApiError } from "./http.js";

function getBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "Missing bearer token.");
  }

  const token = authHeader.slice(7).trim();
  if (!token) throw new ApiError(401, "Missing bearer token.");
  return token;
}

export async function requireProfile(req, adminClient, { roles = null, requireActive = true } = {}) {
  const token = getBearerToken(req);

  const {
    data: { user },
    error: userError,
  } = await adminClient.auth.getUser(token);

  if (userError || !user) {
    throw new ApiError(401, "Invalid auth token.", userError?.message || null);
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new ApiError(403, "Profile not found.", profileError?.message || null);
  }
  if (requireActive && profile.is_active === false) {
    throw new ApiError(403, "Account is inactive.");
  }
  if (Array.isArray(roles) && roles.length > 0 && !roles.includes(profile.role)) {
    throw new ApiError(403, `Access denied for role '${profile.role}'.`);
  }

  return { user, profile };
}

export async function requireAdmin(req, adminClient) {
  return requireProfile(req, adminClient, { roles: ["admin"], requireActive: true });
}
