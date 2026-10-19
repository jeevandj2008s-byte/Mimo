import assert from "node:assert/strict";
import test from "node:test";
import { hasValidSupabaseConfig, isValidSupabaseKey, isValidSupabaseUrl } from "../lib/supabase/config";

test("Supabase config rejects example placeholders", () => {
  assert.equal(isValidSupabaseUrl("https://your-project.supabase.co"), false);
  assert.equal(isValidSupabaseKey("your-publishable-anon-key"), false);
  assert.equal(hasValidSupabaseConfig("https://your-project.supabase.co", "your-publishable-anon-key"), false);
});

test("Supabase config accepts a real-looking project URL and public key", () => {
  assert.equal(isValidSupabaseUrl("https://mimo-demo.supabase.co"), true);
  assert.equal(isValidSupabaseKey("sb_publishable_12345678901234567890"), true);
  assert.equal(hasValidSupabaseConfig("https://mimo-demo.supabase.co", "sb_publishable_12345678901234567890"), true);
});
