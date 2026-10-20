import assert from "node:assert/strict";
import test from "node:test";
import { authErrorMessage } from "../components/auth-provider";

test("Google provider errors become actionable setup guidance", () => {
  const message = authErrorMessage({ message: "Unsupported provider: provider is not enabled" });
  assert.match(message, /Google sign-in is not enabled in Supabase/);
  assert.doesNotMatch(message, /validation_failed/);
});

test("invalid credentials remain user-friendly", () => {
  assert.equal(authErrorMessage({ message: "Invalid login credentials" }), "That email or password is not correct.");
});
