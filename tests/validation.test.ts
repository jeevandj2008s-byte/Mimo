import assert from "node:assert/strict";
import test from "node:test";
import { isMemory, validateMemoryInput } from "../lib/validation";

test("memory validation trims and normalizes tags", () => {
  const result = validateMemoryInput({ title: "  A decision ", content: "  Keep the note. ", tags: [" Project ", "project", ""] });
  assert.equal(result.valid, true);
  assert.deepEqual(result.value, { title: "A decision", content: "Keep the note.", tags: ["project"] });
});

test("memory validation rejects empty and oversized fields", () => {
  const result = validateMemoryInput({ title: "", content: "" });
  assert.equal(result.valid, false);
  assert.ok(result.errors.title);
  assert.ok(result.errors.content);
  assert.equal(isMemory({ id: "bad", title: "x", content: "y", tags: [], createdAt: "not-a-date", updatedAt: "2026-01-01" }), false);
});
