export function getAssetUrl(supabase, path) {
  if (!path) return null;

  const { data } = supabase.storage
    .from("assets")
    .getPublicUrl(path);

  return data?.publicUrl || null;
}
