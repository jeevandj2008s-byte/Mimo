import { NextResponse } from "next/server";
import { FileExtractionError, MAX_UPLOAD_BYTES, transcribeAudioFile } from "@/lib/file-extractors";
import { createSupabaseServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status });
}

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured()) return errorResponse("Voice fallback needs a configured Supabase account.", "SUPABASE_NOT_CONFIGURED", 503);
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return errorResponse("Sign in before using voice fallback transcription.", "AUTH_REQUIRED", 401);
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return errorResponse("No audio recording was received.", "INVALID_FILE", 400);
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) return errorResponse("Voice recordings must be between 1 byte and 15 MB.", "FILE_TOO_LARGE", 413);
  if (!/\.(webm|wav|mp3)$/i.test(file.name)) return errorResponse("Voice fallback accepts WebM, WAV, or MP3 recordings.", "UNSUPPORTED_FILE_TYPE", 400);
  try {
    const transcript = await transcribeAudioFile(file);
    if (!transcript.trim()) return errorResponse("Mimo could not hear a transcript in that recording.", "EMPTY_TRANSCRIPT", 400);
    return NextResponse.json({ transcript: transcript.trim() });
  } catch (error) {
    if (error instanceof FileExtractionError) {
      const status = error.code === "MISSING_API_KEY" ? 503 : error.code === "PROVIDER_TIMEOUT" ? 504 : 400;
      return errorResponse(error.message, error.code, status);
    }
    return errorResponse("Mimo could not transcribe that recording.", "TRANSCRIPTION_FAILED", 500);
  }
}
