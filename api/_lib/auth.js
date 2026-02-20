import { ApiError } from "./http.js";

export async function requireAdmin(req, adminClient) {
  const authHeader = req.headers.authorization || req.headers.Authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "Missing bearer token.");
  }

  const token = authHeader.slice(7).trim();
  if (!token) throw new ApiError(401, "Missing bearer token.");

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
    throw new ApiError(403, "Admin profile not found.", profileError?.message || null);
  }
  if (profile.role !== "admin" || profile.is_active === false) {
    throw new ApiError(403, "Admin access required.");
  }

  return { user, profile };
}

