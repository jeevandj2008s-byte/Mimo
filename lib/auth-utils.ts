import type { User } from "@supabase/supabase-js";

export function isGuestUser(user: User | null): boolean {
  if (!user) return true;
  const candidate = user as User & { is_anonymous?: boolean };
  return candidate.is_anonymous === true || user.app_metadata?.provider === "anonymous";
}

export function getUserDisplayName(user: User | null): string {
  if (!user || isGuestUser(user)) return "Guest";
  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Mimo member"
  );
}

export function getUserInitials(user: User | null): string {
  const name = getUserDisplayName(user);
  return name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "G";
}
