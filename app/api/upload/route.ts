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
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_UPLOAD_BYTES + 512_000) {
    return errorResponse("Files must be 15 MB or smaller.", 413, "FILE_TOO_LARGE");
  }

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

    // If Supabase is configured and user is signed in, persist to cloud
    let userLoggedIn = false;
    let userId: string | null = null;
    let supabaseClient: Awaited<ReturnType<typeof createSupabaseServerClient>> | null = null;

    if (isSupabaseServerConfigured()) {
      try {
        supabaseClient = await createSupabaseServerClient();
        const { data: userData } = await supabaseClient.auth.getUser();
        if (userData?.user) {
          userLoggedIn = true;
          userId = userData.user.id;
        }
      } catch (authErr) {
        console.warn("[Upload] Supabase auth check failed:", authErr);
      }
    }

    if (userLoggedIn && userId && supabaseClient) {
      // Clean metadata for Supabase: remove heavy fileData from cloud payload
      // so Supabase POST size limits are never exceeded (the binary is stored in client IndexedDB)
      const cleanRows = extracted.map(({ input }) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { fileData, ...restMeta } = input.metadata ?? {};
        return {
          user_id: userId,
          title: input.title,
          content: input.content,
          tags: input.tags,
          metadata: restMeta,
        };
      });

      let { data, error } = await supabaseClient
        .from("memories")
        .insert(cleanRows)
        .select("id,title,content,tags,metadata,created_at,updated_at");

      let metadataStored = true;
      if (error && isMetadataColumnError(error.message)) {
        // Fallback for legacy tables without metadata column
        const legacyRows = cleanRows.map(({ user_id, title, content, tags }) => ({
          user_id,
          title,
          content,
          tags,
        }));
        const fallback = await supabaseClient
          .from("memories")
          .insert(legacyRows)
          .select("id,title,content,tags,created_at,updated_at");
        data = fallback.data as unknown as typeof data;
        error = fallback.error;
        metadataStored = false;
      }

      if (!error && data) {
        const cloudMemories: Memory[] = (
          data as Array<{
            id: string;
            title: string;
            content: string;
            tags: string[];
            metadata?: Memory["metadata"];
            created_at: string;
            updated_at: string;
          }>
        ).map((row, idx) => ({
          id: row.id,
          title: row.title,
          content: row.content,
          tags: row.tags ?? [],
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          metadata: {
            ...extracted[idx]?.input.metadata,
            ...(metadataStored && row.metadata ? row.metadata : {}),
          },
        }));
        return NextResponse.json({ memories: cloudMemories });
      }
    }

    // Guest / local memory fallback: create memory records directly
    const now = new Date().toISOString();
    const guestMemories: Memory[] = extracted.map(({ input }) => ({
      id: crypto.randomUUID(),
      title: input.title,
      content: input.content,
      tags: input.tags,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata,
    }));

    return NextResponse.json({ memories: guestMemories });
  } catch (error) {
    if (error instanceof FileExtractionError) {
      const status = error.code === "MISSING_API_KEY" ? 503 : error.code === "PROVIDER_TIMEOUT" ? 504 : 400;
      return errorResponse(error.message, status, error.code);
    }
    return errorResponse("Mimo could not process this file.", 500, "EXTRACTION_FAILED");
  }
}
