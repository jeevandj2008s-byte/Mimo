export function authErrorMessage(error: { message: string }): string {
  const message = error.message.toLowerCase();
  if (message.includes("missing oauth secret")) {
    return "Google sign-in is missing its OAuth secret. Open Supabase → Authentication → Providers → Google and save Google's Web OAuth Client Secret (not a Supabase key), then try again.";
  }
  if (message.includes("invalid login credentials")) return "That email or password is not correct.";
  if (message.includes("email not confirmed")) return "Please confirm your email before signing in.";
  if (message.includes("unsupported provider") || message.includes("provider is not enabled")) {
    return "Google sign-in is not enabled in Supabase yet. Open Supabase → Authentication → Providers → Google, enable it, add Google OAuth credentials, and try again.";
  }
  if (message.includes("redirect_uri_mismatch") || message.includes("redirect uri mismatch")) {
    return "Google rejected the callback. In the Google OAuth Web client used by Supabase, add https://gldbtyhgzpudfnuuhauf.supabase.co/auth/v1/callback exactly, with no trailing slash.";
  }
  if (message.includes("redirect url") || message.includes("redirect_uri")) {
    return "Google sign-in needs the Supabase callback URL in the Google OAuth Web client and http://localhost:3000/auth/callback in Supabase URL Configuration.";
  }
  return error.message;
}
