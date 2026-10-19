import type { Memory, RetrievalOptions } from "./types";

const STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "am",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "did",
  "do",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "was",
  "what",
  "when",
  "where",
  "which",
  "why",
  "with",
  "you",
  "your",
]);

export const DEFAULT_RETRIEVAL_LIMIT = 5;
export const DEFAULT_RELEVANCE_THRESHOLD = 4;

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value: string): string[] {
  return [...new Set(normalizeSearchText(value).split(" ").filter((token) => token.length > 1 && !STOP_WORDS.has(token)))];
}

export function scoreMemory(query: string, memory: Memory): number {
  const queryText = normalizeSearchText(query);
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;

  const title = normalizeSearchText(memory.title);
  const tags = memory.tags.map(normalizeSearchText);
  const content = normalizeSearchText(memory.content);
  let score = 0;

  if (queryText.length > 4 && title.includes(queryText)) score += 14;
  if (queryText.length > 4 && content.includes(queryText)) score += 4;

  for (const token of queryTokens) {
    if (title.split(" ").includes(token)) score += 10;
    else if (title.includes(token)) score += 6;

    if (tags.some((tag) => tag === token || tag.split(" ").includes(token))) score += 8;
    else if (tags.some((tag) => tag.includes(token))) score += 5;

    if (content.split(" ").includes(token)) score += 3;
    else if (content.includes(token)) score += 1;
  }

  return score;
}

export function searchMemories(
  query: string,
  memories: Memory[],
  options: RetrievalOptions = {},
): Memory[] {
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_RETRIEVAL_LIMIT, 10));
  const threshold = options.threshold ?? DEFAULT_RELEVANCE_THRESHOLD;

  return memories
    .map((memory, index) => ({ memory, score: scoreMemory(query, memory), index }))
    .filter(({ score }) => score >= threshold)
    .sort((a, b) => b.score - a.score || Date.parse(b.memory.updatedAt) - Date.parse(a.memory.updatedAt) || a.index - b.index)
    .slice(0, limit)
    .map(({ memory }) => memory);
}
