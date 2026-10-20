import { NextResponse } from "next/server";
import { extractUpload, FileExtractionError, MAX_UPLOAD_BYTES } from "@/lib/file-extractors";
import { createSupabaseServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server";
import type { Memory } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number, code: string) {
  return NextResponse.json({ error: message, code }, { status });
}

function isMetadataColumnError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("metadata") && (normalized.includes("column") || normalized.includes("schema cache"));
}

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured()) return errorResponse("File uploads require a configured Supabase account.", 503, "SUPABASE_NOT_CONFIGURED");
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return errorResponse("Sign in before uploading a memory.", 401, "AUTH_REQUIRED");

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_UPLOAD_BYTES + 512_000) return errorResponse("Files must be 15 MB or smaller.", 413, "FILE_TOO_LARGE");

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("Send a valid multipart file upload.", 400, "INVALID_FILE");
  }
  const file = formData.get("file");
  if (!(file instanceof File)) return errorResponse("Choose a file to upload.", 400, "INVALID_FILE");

  try {
    const extracted = await extractUpload(file);
    const rows = extracted.map(({ input }) => ({ user_id: userData.user.id, title: input.title, content: input.content, tags: input.tags, metadata: input.metadata ?? {} }));
    let { data, error } = await supabase.from("memories").insert(rows).select("id,title,content,tags,metadata,created_at,updated_at");
    let metadataStored = true;
    if (error && isMetadataColumnError(error.message)) {
      // Existing Mimo databases may predate the metadata migration. Keep the
      // upload searchable instead of breaking the core workflow; filename and
      // file type remain in the generated title/tags until the migration runs.
      const legacyRows = rows.map(({ user_id, title, content, tags }) => ({ user_id, title, content, tags }));
      const fallback = await supabase.from("memories").insert(legacyRows).select("id,title,content,tags,created_at,updated_at");
      data = fallback.data as unknown as typeof data;
      error = fallback.error;
      metadataStored = false;
    }
    if (error || !data) {
      return errorResponse("Mimo could not save the processed file.", 500, "MEMORY_STORE_ERROR");
    }
    const memories: Memory[] = (data as Array<{ id: string; title: string; content: string; tags: string[]; metadata?: Memory["metadata"]; created_at: string; updated_at: string }>).map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      tags: row.tags ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ...(metadataStored && row.metadata ? { metadata: row.metadata } : {}),
    }));
    return NextResponse.json({ memories });
  } catch (error) {
    if (error instanceof FileExtractionError) {
      const status = error.code === "MISSING_API_KEY" ? 503 : error.code === "PROVIDER_TIMEOUT" ? 504 : 400;
      return errorResponse(error.message, status, error.code);
    }
    return errorResponse("Mimo could not process this file.", 500, "EXTRACTION_FAILED");
  }
}
