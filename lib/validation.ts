import type { Memory, MemoryInput } from "./types";

export const MAX_TITLE_LENGTH = 120;
export const MAX_CONTENT_LENGTH = 8000;
export const MAX_TAG_LENGTH = 32;
export const MAX_TAGS = 8;

export type MemoryValidationErrors = {
  title?: string;
  content?: string;
  tags?: string;
};

export function validateMemoryInput(input: Partial<MemoryInput>): {
  valid: boolean;
  errors: MemoryValidationErrors;
  value?: MemoryInput;
} {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const content = typeof input.content === "string" ? input.content.trim() : "";
  const tags = Array.isArray(input.tags)
    ? input.tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    : [];
  const errors: MemoryValidationErrors = {};

  if (!title) errors.title = "Give this memory a short title.";
  if (title.length > MAX_TITLE_LENGTH) {
    errors.title = `Titles must be ${MAX_TITLE_LENGTH} characters or fewer.`;
  }
  if (!content) errors.content = "Write down the detail you want Mimo to remember.";
  if (content.length > MAX_CONTENT_LENGTH) {
    errors.content = `Memory content must be ${MAX_CONTENT_LENGTH} characters or fewer.`;
  }
  if (tags.length > MAX_TAGS) errors.tags = `Use up to ${MAX_TAGS} tags.`;
  if (tags.some((tag) => tag.length > MAX_TAG_LENGTH)) {
    errors.tags = `Each tag must be ${MAX_TAG_LENGTH} characters or fewer.`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    ...(Object.keys(errors).length === 0
      ? { value: { title, content, tags: [...new Set(tags)] } }
      : {}),
  };
}

export function isMemory(value: unknown): value is Memory {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.title === "string" &&
    typeof candidate.content === "string" &&
    Array.isArray(candidate.tags) &&
    candidate.tags.every((tag) => typeof tag === "string") &&
    typeof candidate.createdAt === "string" &&
    !Number.isNaN(Date.parse(candidate.createdAt)) &&
    typeof candidate.updatedAt === "string" &&
    !Number.isNaN(Date.parse(candidate.updatedAt))
  );
}

export function isCitation(value: unknown): value is { memoryId: string; quote: string } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.memoryId === "string" &&
    candidate.memoryId.length > 0 &&
    typeof candidate.quote === "string" &&
    candidate.quote.trim().length > 0 &&
    candidate.quote.length <= 600
  );
}
