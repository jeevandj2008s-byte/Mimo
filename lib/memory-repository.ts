import { supabase } from "./supabase/client";
import { validateMemoryInput } from "./validation";
import type { Memory, MemoryInput } from "./types";

type MemoryRow = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

function toMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
  const { data, error } = await client.from("memories").select("id,title,content,tags,created_at,updated_at").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as MemoryRow[]).map(toMemory);
}

export async function createCloudMemory(input: MemoryInput): Promise<Memory> {
  const checked = validateMemoryInput(input);
  if (!checked.valid || !checked.value) throw new Error("Invalid memory input.");
  const client = requireClient();
  const userId = await currentUserId();
  const { data, error } = await client.from("memories").insert({ user_id: userId, title: checked.value.title, content: checked.value.content, tags: checked.value.tags }).select("id,title,content,tags,created_at,updated_at").single();
  if (error || !data) throw new Error(error?.message ?? "Could not save memory.");
  return toMemory(data as MemoryRow);
}

export async function updateCloudMemory(id: string, input: MemoryInput): Promise<Memory> {
  const checked = validateMemoryInput(input);
  if (!checked.valid || !checked.value) throw new Error("Invalid memory input.");
  const client = requireClient();
  const { data, error } = await client.from("memories").update({ title: checked.value.title, content: checked.value.content, tags: checked.value.tags, updated_at: new Date().toISOString() }).eq("id", id).select("id,title,content,tags,created_at,updated_at").single();
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
  const { data, error } = await client.from("memories").insert(checked.map((input) => ({ user_id: userId, title: input.title, content: input.content, tags: input.tags }))).select("id,title,content,tags,created_at,updated_at");
  if (error) throw new Error(error.message);
  return (data as MemoryRow[]).map(toMemory);
}
