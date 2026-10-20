"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AuthChangeEvent, User } from "@supabase/supabase-js";
import { getUserDisplayName, isGuestUser } from "@/lib/auth-utils";
import { isSupabaseConfigured, supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/client";

const GUEST_ID_KEY = "mimo.guest.id";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  guestId: string;
  authError: string | null;
  isGuest: boolean;
  displayName: string;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function localGuestId(): string {
  if (typeof window === "undefined") return "guest";
  try {
    const existing = window.localStorage.getItem(GUEST_ID_KEY);
    if (existing) return existing;
    const id = `guest-${crypto.randomUUID().slice(0, 8)}`;
    window.localStorage.setItem(GUEST_ID_KEY, id);
    return id;
  } catch {
    return "guest";
  }
}

export function authErrorMessage(error: { message: string }): string {
  const message = error.message.toLowerCase();
  if (message.includes("invalid login credentials")) return "That email or password is not correct.";
  if (message.includes("email not confirmed")) return "Please confirm your email before signing in.";
  if (message.includes("unsupported provider") || message.includes("provider is not enabled")) {
    return "Google sign-in is not enabled in Supabase yet. Open Supabase → Authentication → Providers → Google, enable it, add Google OAuth credentials, and try again.";
  }
  if (message.includes("redirect url") || message.includes("redirect_uri")) {
    return "Google sign-in needs the localhost callback URL in Supabase Authentication → URL Configuration.";
  }
  return error.message;
}

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [guestId, setGuestId] = useState("guest");

  useEffect(() => {
    setGuestId(localGuestId());
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;

    let active = true;
    const ensureGuestSession = async () => {
      const { data, error } = await client.auth.signInAnonymously();
      if (!active) return;
      if (error) {
        setAuthError("Guest mode is available locally. Enable Anonymous Sign-Ins in Supabase to sync guest memories.");
        setUser(null);
      } else {
        setUser(data.user);
        setAuthError(null);
      }
      setLoading(false);
    };

    void (async () => {
      const { data } = await client.auth.getSession();
      if (!active) return;
      if (data.session?.user) {
        setUser(data.session.user);
        setLoading(false);
      } else {
        await ensureGuestSession();
      }
    })();

    const { data: listener } = client.auth.onAuthStateChange(async (_event: AuthChangeEvent, session) => {
      if (!active) return;
      if (session?.user) {
        setUser(session.user);
        setAuthError(null);
        setLoading(false);
      } else if (_event === "SIGNED_OUT") {
        // Do not call another Supabase auth method inside this callback. The
        // SDK holds an internal lock while notifying listeners. A signed-out
        // browser safely falls back to local guest mode until the next load.
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    configured: isSupabaseConfigured,
    guestId: user && isGuestUser(user) ? user.id : guestId,
    authError,
    isGuest: isGuestUser(user),
    displayName: getUserDisplayName(user),
    signInWithGoogle: async () => {
      if (!supabase) return { error: "Add the Supabase environment variables to enable account login." };
      if (supabaseUrl && supabaseAnonKey) {
        try {
          const providerResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
            headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
          });
          const providerSettings = await providerResponse.json() as { external?: { google?: boolean } };
          if (!providerResponse.ok || providerSettings.external?.google !== true) {
            return { error: "Google sign-in is not enabled in Supabase yet. Open Supabase → Authentication → Providers → Google, add Google OAuth credentials, enable it, and try again." };
          }
        } catch {
          return { error: "Mimo could not verify Google sign-in with Supabase. Check your Supabase URL and try again." };
        }
      }
      const options = { redirectTo: `${window.location.origin}/auth/callback` };
      const { error } = user && isGuestUser(user)
        ? await supabase.auth.linkIdentity({ provider: "google", options })
        : await supabase.auth.signInWithOAuth({
        provider: "google",
          options,
        });
      return { error: error ? authErrorMessage(error) : null };
    },
    signInWithEmail: async (email, password) => {
      if (!supabase) return { error: "Add the Supabase environment variables to enable account login." };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ? authErrorMessage(error) : null };
    },
    signUpWithEmail: async (email, password) => {
      if (!supabase) return { error: "Add the Supabase environment variables to enable account login.", needsConfirmation: false };
      const client = supabase;
      const guest = user && isGuestUser(user);
      const result = guest
        ? await client.auth.updateUser({ email, password })
        : await client.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
      const session = "session" in result.data ? result.data.session : null;
      return {
        error: result.error ? authErrorMessage(result.error) : null,
        needsConfirmation: !result.error && !session,
      };
    },
    signOut: async () => {
      if (!supabase) return { error: null };
      const { error } = await supabase.auth.signOut();
      if (!error) {
        // Start a fresh guest session outside the auth listener so a user can
        // keep using Mimo without ever seeing another account's memories.
        await supabase.auth.signInAnonymously();
      }
      return { error: error ? authErrorMessage(error) : null };
    },
  }), [authError, guestId, loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
