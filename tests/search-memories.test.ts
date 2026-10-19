import assert from "node:assert/strict";
import test from "node:test";
import { searchMemories, scoreMemory } from "../lib/search-memories";
import type { Memory } from "../lib/types";

const memory = (id: string, title: string, content: string, tags: string[] = []): Memory => ({
  id,
  title,
  content,
  tags,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

test("retrieval prioritizes title and tag matches over incidental content", () => {
  const titleMatch = memory("title", "AI project decision", "A note about a useful project.");
  const tagMatch = memory("tag", "Weekend notes", "Something else.", ["ai-project"]);
  const contentMatch = memory("content", "A random note", "I mentioned an AI project in passing.");

  const results = searchMemories("AI project decision", [contentMatch, tagMatch, titleMatch]);
  assert.deepEqual(results.slice(0, 2).map((item) => item.id), ["title", "tag"]);
  assert.ok(scoreMemory("AI project decision", titleMatch) > scoreMemory("AI project decision", contentMatch));
});

test("retrieval returns no evidence for an unrelated question", () => {
  const memories = [memory("one", "Study plan", "Read the HCI paper on Tuesday.", ["study"]), memory("two", "Lunch idea", "Try the new noodle place.")];
  assert.deepEqual(searchMemories("What is my passport number?", memories), []);
});

test("retrieval is bounded and does not return recent notes without relevance", () => {
  const memories = Array.from({ length: 8 }, (_, index) => memory(String(index), `Project ${index}`, `This note is about topic ${index}.`));
  const results = searchMemories("topic", memories, { limit: 5, threshold: 4 });
  assert.equal(results.length, 5);
});
