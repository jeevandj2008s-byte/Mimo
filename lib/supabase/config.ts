export function isValidSupabaseUrl(value: string | undefined): value is string {
  if (!value || value.includes("your-project") || value.includes("your-project.supabase.co")) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
}

export function isValidSupabaseKey(value: string | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 20 && !normalized.includes("your-") && !normalized.includes("placeholder");
}

export function hasValidSupabaseConfig(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
): url is string {
  return isValidSupabaseUrl(url) && isValidSupabaseKey(key);
}
