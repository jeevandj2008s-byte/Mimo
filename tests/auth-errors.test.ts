import assert from "node:assert/strict";
import test from "node:test";
import { authErrorMessage } from "../lib/auth-errors";

test("missing Google OAuth secret takes priority over unsupported provider", () => {
  const message = authErrorMessage({ message: "Unsupported provider: missing OAuth secret" });
  assert.match(message, /save Google's Web OAuth Client Secret/);
  assert.match(message, /not a Supabase key/);
  assert.match(message, /Supabase → Authentication → Providers → Google/);
  assert.doesNotMatch(message, /not enabled|Unsupported provider|validation_failed/);
  assert.equal(authErrorMessage({ message: "UNSUPPORTED PROVIDER: MISSING OAUTH SECRET" }), message);
});

test("Google provider errors become actionable setup guidance", () => {
  const message = authErrorMessage({ message: "Unsupported provider: provider is not enabled" });
  assert.match(message, /Google sign-in is not enabled in Supabase/);
  assert.doesNotMatch(message, /validation_failed/);
});

test("invalid credentials remain user-friendly", () => {
  assert.equal(authErrorMessage({ message: "Invalid login credentials" }), "That email or password is not correct.");
});

test("Google redirect mismatch identifies the Google Cloud callback", () => {
  const message = authErrorMessage({ message: "Error 400: redirect_uri_mismatch" });
  assert.match(message, /gldbtyhgzpudfnuuhauf\.supabase\.co\/auth\/v1\/callback/);
  assert.match(message, /Google OAuth Web client/);
});

test("unconfirmed email remains user-friendly", () => {
  assert.equal(authErrorMessage({ message: "Email not confirmed" }), "Please confirm your email before signing in.");
});

test("both existing redirect error forms retain callback setup guidance", () => {
  for (const message of ["Redirect URL is not allowed", "Invalid redirect_uri"]) {
    assert.equal(authErrorMessage({ message }), "Google sign-in needs the Supabase callback URL in the Google OAuth Web client and http://localhost:3000/auth/callback in Supabase URL Configuration.");
  }
});

test("other auth errors retain their original message", () => {
  assert.equal(authErrorMessage({ message: "Please try again later." }), "Please try again later.");
});
