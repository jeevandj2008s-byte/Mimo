import { authErrorMessage } from "./auth-errors";
import { isValidSupabaseKey, isValidSupabaseUrl } from "./supabase/config";

function notReady(code: string, error: string) {
  return { ready: false, code, error };
}

function isGoogleRedirect(location: string | null): boolean {
  if (!location) return false;
  try {
    const target = new URL(location);
    return target.origin === "https://accounts.google.com" && !target.username && !target.password;
  } catch {
    return false;
  }
}

function isTimeout(error: unknown, signal: AbortSignal): boolean {
  return signal.aborted || (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"));
}

export async function checkGoogleOAuthReadiness(options: {
  url: string | undefined;
  key: string | undefined;
  redirectTo: string;
  fetcher?: typeof fetch;
}): Promise<{ ready: boolean; code: string; error: string | null }> {
  const { url, key, redirectTo, fetcher = fetch } = options;
  if (!isValidSupabaseUrl(url) || !isValidSupabaseKey(key)) {
    return notReady("invalid_config", "Add valid Supabase environment variables to enable Google sign-in.");
  }

  const authorizeUrl = new URL("/auth/v1/authorize", url);
  if (authorizeUrl.username || authorizeUrl.password) {
    return notReady("invalid_config", "Add valid Supabase environment variables to enable Google sign-in.");
  }
  try {
    const callback = new URL(redirectTo);
    if (!["http:", "https:"].includes(callback.protocol) || callback.username || callback.password) {
      throw new Error("Invalid callback URL");
    }
  } catch {
    return notReady("invalid_redirect", "Google sign-in needs a valid HTTP or HTTPS callback URL.");
  }
  authorizeUrl.searchParams.set("provider", "google");
  authorizeUrl.searchParams.set("redirect_to", redirectTo);

  const signal = AbortSignal.timeout(8000);
  const timeoutError = "Google sign-in verification timed out. Please try again.";
  const providerError = "Google sign-in could not be verified with Supabase. Check the Google provider configuration and try again.";
  try {
    const response = await fetcher(authorizeUrl.toString(), {
      method: "GET",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      redirect: "manual",
      cache: "no-store",
      credentials: "omit",
      signal,
    });
    if (response.status >= 300 && response.status < 400) {
      if (isGoogleRedirect(response.headers.get("location"))) {
        return { ready: true, code: "ready", error: null };
      }
      return notReady("invalid_provider_redirect", "Supabase did not return a valid Google sign-in redirect. Check the Google provider configuration and try again.");
    }
    if (response.status === 400) {
      let body: unknown;
      try {
        body = await response.json();
      } catch (error) {
        return isTimeout(error, signal)
          ? notReady("timeout", timeoutError)
          : notReady("invalid_response", providerError);
      }
      const message = body && typeof body === "object" && "msg" in body && typeof body.msg === "string"
        ? body.msg.toLowerCase()
        : "";
      if (message.includes("missing oauth secret")) {
        return notReady("missing_oauth_secret", authErrorMessage({ message: "missing OAuth secret" }));
      }
      if (message.includes("provider is not enabled") || message.includes("provider not enabled") || message.includes("provider is disabled")) {
        return notReady("provider_disabled", authErrorMessage({ message: "provider is not enabled" }));
      }
      return notReady("provider_error", providerError);
    }
    return notReady("unexpected_status", providerError);
  } catch (error) {
    return isTimeout(error, signal)
      ? notReady("timeout", timeoutError)
      : notReady("network_error", "Google sign-in could not be verified with Supabase. Check your connection and try again.");
  }
}
