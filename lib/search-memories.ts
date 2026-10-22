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
  "can",
  "could",
  "did",
  "do",
  "for",
  "from",
  "give",
  "have",
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
  "please",
  "return",
  "show",
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

const SYNONYMS: Record<string, string[]> = {
  phy: ["physics"],
  physics: ["phy"],
  chem: ["chemistry"],
  chemistry: ["chem"],
  bio: ["biology"],
  biology: ["bio"],
  math: ["maths", "mathematics"],
  maths: ["math", "mathematics"],
  mathematics: ["math", "maths"],
  calc: ["calculus"],
  calculus: ["calc"],
  doc: ["document", "file"],
  document: ["doc", "file"],
  pdf: ["file", "document"],
};

export const DEFAULT_RETRIEVAL_LIMIT = 5;
export const DEFAULT_RELEVANCE_THRESHOLD = 3;

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
  const baseTokens = normalizeSearchText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

  const expanded: string[] = [];
  for (const token of baseTokens) {
    expanded.push(token);
    const syns = SYNONYMS[token];
    if (syns) {
      expanded.push(...syns);
    }
  }

  return [...new Set(expanded)];
}

export function scoreMemory(query: string, memory: Memory): number {
  const queryText = normalizeSearchText(query);
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;

  const title = normalizeSearchText(memory.title);
  const tags = memory.tags.map(normalizeSearchText);
  const content = normalizeSearchText(memory.content);
  const originalName = normalizeSearchText(memory.metadata?.originalName || "");
  const isUploadedFile =
    memory.metadata?.sourceType === "upload" ||
    tags.includes("upload") ||
    Boolean(memory.metadata?.originalName);

  let score = 0;

  // Exact phrase match in title or original filename
  if (queryText.length > 3) {
    if (title.includes(queryText)) score += 16;
    if (originalName.includes(queryText)) score += 16;
    if (content.includes(queryText)) score += 5;
  }

  // Check file type requests
  const wantsPdf = queryTokens.includes("pdf");
  const isPdf =
    tags.includes("pdf") ||
    memory.metadata?.extractor === "pdf" ||
    originalName.endsWith("pdf");
  if (wantsPdf && isPdf) {
    score += 12;
  }

  const wantsDoc = queryTokens.some((t) => ["doc", "document", "file", "notes"].includes(t));
  if (wantsDoc && isUploadedFile) {
    score += 6;
  }

  for (const token of queryTokens) {
    // Title matches
    const titleWords = title.split(" ");
    if (titleWords.includes(token)) score += 10;
    else if (title.includes(token)) score += 6;

    // Filename matches
    if (originalName) {
      const nameWords = originalName.split(" ");
      if (nameWords.includes(token)) score += 10;
      else if (originalName.includes(token)) score += 6;
    }

    // Tags matches
    if (tags.some((tag) => tag === token || tag.split(" ").includes(token))) score += 8;
    else if (tags.some((tag) => tag.includes(token))) score += 5;

    // Content matches
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

  const scored = memories
    .map((memory, index) => ({ memory, score: scoreMemory(query, memory), index }))
    .filter(({ score }) => score >= threshold)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Date.parse(b.memory.updatedAt) - Date.parse(a.memory.updatedAt) ||
        a.index - b.index,
    );

  // If no memories reached the threshold, but memories exist and query had words,
  // do a fuzzy best-effort fallback so user query doesn't fail unnecessarily
  if (scored.length === 0 && memories.length > 0) {
    const fallbackScored = memories
      .map((memory, index) => ({ memory, score: scoreMemory(query, memory), index }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index);

    if (fallbackScored.length > 0) {
      return fallbackScored.slice(0, limit).map(({ memory }) => memory);
    }
  }

  return scored.slice(0, limit).map(({ memory }) => memory);
}
