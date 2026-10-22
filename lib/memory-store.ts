import { isMemory, validateMemoryInput } from "./validation";
import type { Memory, MemoryInput } from "./types";

export const MEMORY_STORAGE_KEY = "mimo.memories.v1";

function sortMemories(memories: Memory[]): Memory[] {
  return [...memories].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function loadMemories(): Memory[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(MEMORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortMemories(
      parsed.filter(isMemory).map((memory) => ({
        ...memory,
        title: memory.title.trim(),
        content: memory.content.trim(),
        tags: memory.tags.filter(Boolean).map((tag) => tag.trim()).filter(Boolean),
      })),
    );
  } catch {
    return [];
  }
}

export function persistMemories(memories: Memory[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(sortMemories(memories)));
  } catch (error) {
    // If localStorage quota is reached (e.g. from large embedded fileData),
    // strip the heavy fileData string from the localStorage cache. The actual
    // binary file remains safely stored in IndexedDB.
    try {
      const stripped = memories.map((m) => {
        if (!m.metadata?.fileData) return m;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { fileData, ...restMeta } = m.metadata;
        return { ...m, metadata: restMeta };
      });
      window.localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(sortMemories(stripped)));
    } catch {
      console.warn("Could not persist memories to localStorage:", error);
    }
  }
}

export function createMemory(input: MemoryInput): Memory {
  const checked = validateMemoryInput(input);
  if (!checked.valid || !checked.value) throw new Error("Invalid memory input");
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), ...checked.value, createdAt: now, updatedAt: now };
}

export function updateMemory(memory: Memory, input: MemoryInput): Memory {
  const checked = validateMemoryInput(input);
  if (!checked.valid || !checked.value) throw new Error("Invalid memory input");
  return { ...memory, ...checked.value, updatedAt: new Date().toISOString() };
}

export function addDemoMemories(existing: Memory[], demoMemories: Memory[]): Memory[] {
  const existingIds = new Set(existing.map((memory) => memory.id));
  return sortMemories([...existing, ...demoMemories.filter((memory) => !existingIds.has(memory.id))]);
}
