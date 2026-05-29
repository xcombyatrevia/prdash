export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  return res.status(200).json({
    hasSupabaseUrl: Boolean(supabaseUrl),
    supabaseUrl,
    supabaseUrlLooksCorrect:
      supabaseUrl === "https://yudkngnpcgfgqseuupxr.supabase.co",
    hasServiceRoleKey: Boolean(serviceRole),
    serviceRoleKeyLength: serviceRole.length,
    serviceRoleKeyStartsWithEyJ: serviceRole.startsWith("eyJ"),
  });
}
