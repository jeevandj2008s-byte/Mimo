import { supabase } from "./supabase/client";
import { validateMemoryInput } from "./validation";
import type { Memory, MemoryInput } from "./types";

type MemoryRow = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  metadata?: Memory["metadata"];
  created_at: string;
  updated_at: string;
};

const MEMORY_COLUMNS = "id,title,content,tags,metadata,created_at,updated_at";
const LEGACY_MEMORY_COLUMNS = "id,title,content,tags,created_at,updated_at";

function missingMetadataColumn(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("metadata") && (normalized.includes("column") || normalized.includes("schema cache"));
}

function toMemory(row: MemoryRow): Memory {
  const tags = Array.isArray(row.tags) ? row.tags : [];
  let metadata = row.metadata;

  // If metadata column was missing in Supabase, infer from tags and title
  if (!metadata || Object.keys(metadata).length === 0) {
    const isPdf = tags.includes("pdf") || row.title.toLowerCase().includes("pdf");
    const isImage = tags.some((t) => ["jpg", "jpeg", "png", "webp", "ocr"].includes(t));
    const isAudio = tags.some((t) => ["audio", "mp3", "wav", "webm"].includes(t));
    const isUpload = tags.includes("upload") || isPdf || isImage || isAudio;

    if (isUpload) {
      metadata = {
        sourceType: "upload",
        extractor: isPdf ? "pdf" : isImage ? "ocr" : isAudio ? "audio" : "text",
        originalName: isPdf && !row.title.toLowerCase().endsWith(".pdf") ? `${row.title}.pdf` : row.title,
      };
    }
  }

  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(metadata ? { metadata } : {}),
  };
}

function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

async function currentUserId() {
  const client = requireClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Your session expired. Please sign in again.");
  return data.user.id;
}

export async function loadCloudMemories(): Promise<Memory[]> {
  const client = requireClient();
  let { data, error } = await client.from("memories").select(MEMORY_COLUMNS).order("updated_at", { ascending: false });
  if (error && missingMetadataColumn(error.message)) {
    const fallback = await client.from("memories").select(LEGACY_MEMORY_COLUMNS).order("updated_at", { ascending: false });
    data = fallback.data as unknown as typeof data;
    error = fallback.error;
  }
  if (error) throw new Error(error.message);
  return (data as MemoryRow[]).map(toMemory);
}

export async function createCloudMemory(input: MemoryInput): Promise<Memory> {
  const checked = validateMemoryInput(input);
  if (!checked.valid || !checked.value) throw new Error("Invalid memory input.");
  const client = requireClient();
  const userId = await currentUserId();
  let { data, error } = await client.from("memories").insert({ user_id: userId, title: checked.value.title, content: checked.value.content, tags: checked.value.tags, metadata: checked.value.metadata ?? {} }).select(MEMORY_COLUMNS).single();
  if (error && missingMetadataColumn(error.message) && !checked.value.metadata) {
    const fallback = await client.from("memories").insert({ user_id: userId, title: checked.value.title, content: checked.value.content, tags: checked.value.tags }).select(LEGACY_MEMORY_COLUMNS).single();
    data = fallback.data as unknown as typeof data;
    error = fallback.error;
  }
  if (error || !data) throw new Error(error?.message ?? "Could not save memory.");
  return toMemory(data as MemoryRow);
}

export async function updateCloudMemory(id: string, input: MemoryInput): Promise<Memory> {
  const checked = validateMemoryInput(input);
  if (!checked.valid || !checked.value) throw new Error("Invalid memory input.");
  const client = requireClient();
  let { data, error } = await client.from("memories").update({ title: checked.value.title, content: checked.value.content, tags: checked.value.tags, updated_at: new Date().toISOString() }).eq("id", id).select(MEMORY_COLUMNS).single();
  if (error && missingMetadataColumn(error.message)) {
    const fallback = await client.from("memories").update({ title: checked.value.title, content: checked.value.content, tags: checked.value.tags, updated_at: new Date().toISOString() }).eq("id", id).select(LEGACY_MEMORY_COLUMNS).single();
    data = fallback.data as unknown as typeof data;
    error = fallback.error;
  }
  if (error || !data) throw new Error(error?.message ?? "Could not update memory.");
  return toMemory(data as MemoryRow);
}

export async function deleteCloudMemory(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("memories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function insertCloudMemories(inputs: MemoryInput[]): Promise<Memory[]> {
  const checked = inputs.map((input) => validateMemoryInput(input)).filter((result) => result.valid && result.value).map((result) => result.value as MemoryInput);
  if (!checked.length) return [];
  const client = requireClient();
  const userId = await currentUserId();
  let { data, error } = await client.from("memories").insert(checked.map((input) => ({ user_id: userId, title: input.title, content: input.content, tags: input.tags, metadata: input.metadata ?? {} }))).select(MEMORY_COLUMNS);
  if (error && missingMetadataColumn(error.message) && checked.every((input) => !input.metadata)) {
    const fallback = await client.from("memories").insert(checked.map((input) => ({ user_id: userId, title: input.title, content: input.content, tags: input.tags }))).select(LEGACY_MEMORY_COLUMNS);
    data = fallback.data as unknown as typeof data;
    error = fallback.error;
  }
  if (error) throw new Error(error.message);
  return (data as MemoryRow[]).map(toMemory);
}
