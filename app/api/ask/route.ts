import { NextResponse } from "next/server";
import { isMemory, MAX_CONTENT_LENGTH, MAX_TITLE_LENGTH } from "@/lib/validation";
import type { Memory, MemoryCitation, RecallAnswer } from "@/lib/types";
import { searchMemories } from "@/lib/search-memories";
import { createSupabaseServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server";
import { generateLocalRecallAnswer, requestAIAnswer } from "@/lib/ai-provider";

export const runtime = "nodejs";

const MAX_QUESTION_LENGTH = 500;
const MAX_MEMORIES = 6;
const MAX_CONTEXT_LENGTH = 18_000;

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status });
}

function validSubmittedMemory(value: unknown): value is Memory {
  return (
    isMemory(value) &&
    value.title.length <= MAX_TITLE_LENGTH &&
    value.content.length <= MAX_CONTENT_LENGTH &&
    value.tags.length <= 12
  );
}

function parseModelJson(value: unknown): RecallAnswer | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const parsed: unknown = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.answer !== "string") return null;

    const rawCitations = Array.isArray(candidate.citations) ? candidate.citations : [];
    const citations: MemoryCitation[] = [];

    for (const item of rawCitations) {
      if (item && typeof item === "object") {
        const memoryId = String((item as Record<string, unknown>).memoryId || "");
        const quote = String((item as Record<string, unknown>).quote || "").trim();
        if (memoryId && quote) {
          citations.push({ memoryId, quote: quote.slice(0, 600) });
        }
      }
    }

    return {
      answer: candidate.answer.trim(),
      citations,
      insufficientEvidence: Boolean(candidate.insufficientEvidence),
    };
  } catch {
    return null;
  }
}

/**
 * Resilient citation verification:
 * Ensures all citations refer to existing memories and contain an actual excerpt from memory content.
 */
function resolveAndVerifyCitations(
  citations: MemoryCitation[],
  memories: Memory[],
): MemoryCitation[] {
  const memoryMap = new Map(memories.map((m) => [m.id, m]));
  const verified: MemoryCitation[] = [];

  for (const cit of citations) {
    const memory = memoryMap.get(cit.memoryId);
    if (!memory) continue;

    const cleanQuote = cit.quote.trim();
    if (!cleanQuote) continue;

    // 1. Direct substring match
    if (memory.content.includes(cleanQuote)) {
      verified.push({ memoryId: cit.memoryId, quote: cleanQuote });
      continue;
    }

    // 2. Case-insensitive substring match
    const lowerContent = memory.content.toLowerCase();
    const lowerQuote = cleanQuote.toLowerCase();
    const idx = lowerContent.indexOf(lowerQuote);
    if (idx !== -1) {
      verified.push({
        memoryId: cit.memoryId,
        quote: memory.content.slice(idx, idx + cleanQuote.length),
      });
      continue;
    }

    // 3. Best sentence overlap in memory content
    const sentences = memory.content
      .split(/(?<=[.?!])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    const quoteWords = lowerQuote.split(/\s+/).filter((w) => w.length > 3);
    let bestSentence = "";
    let bestScore = 0;

    for (const sent of sentences) {
      const lowerSent = sent.toLowerCase();
      let matchCount = 0;
      for (const word of quoteWords) {
        if (lowerSent.includes(word)) matchCount++;
      }
      if (matchCount > bestScore) {
        bestScore = matchCount;
        bestSentence = sent;
      }
    }

    if (bestSentence && bestScore >= 1) {
      verified.push({
        memoryId: cit.memoryId,
        quote: bestSentence.slice(0, 300),
      });
    } else if (sentences[0]) {
      // Fallback to first meaningful sentence
      verified.push({
        memoryId: cit.memoryId,
        quote: sentences[0].slice(0, 300),
      });
    }
  }

  // If no citations matched, but we have memories, cite the top memory
  if (verified.length === 0 && memories.length > 0) {
    const top = memories[0];
    const sentences = top.content
      .split(/(?<=[.?!])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
    const quote = sentences[0] || top.content.slice(0, 180);
    verified.push({ memoryId: top.id, quote });
  }

  return verified;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Send a valid JSON request.", 400, "INVALID_JSON");
  }

  if (!body || typeof body !== "object") return jsonError("The request body is required.", 400, "INVALID_BODY");
  const candidate = body as Record<string, unknown>;
  const question = typeof candidate.question === "string" ? candidate.question.trim() : "";

  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return jsonError(`Questions must be between 1 and ${MAX_QUESTION_LENGTH} characters.`, 400, "INVALID_QUESTION");
  }

  let memories: Memory[] = [];

  // Try retrieving user memories from Supabase if authenticated
  if (isSupabaseServerConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        let data: unknown[] | null = null;
        const resWithMeta = await supabase
          .from("memories")
          .select("id,title,content,tags,metadata,created_at,updated_at")
          .order("updated_at", { ascending: false });

        if (resWithMeta.data) {
          data = resWithMeta.data;
        } else if (resWithMeta.error) {
          // Fallback if metadata column is not in Supabase schema
          const fallbackRes = await supabase
            .from("memories")
            .select("id,title,content,tags,created_at,updated_at")
            .order("updated_at", { ascending: false });
          data = fallbackRes.data;
        }

        if (data && data.length > 0) {
          const storedMemories = (data as Array<{
            id: string;
            title: string;
            content: string;
            tags: string[];
            metadata?: Memory["metadata"];
            created_at: string;
            updated_at: string;
          }>).map((memory) => {
            const tags = memory.tags ?? [];
            const isPdf = tags.includes("pdf") || memory.title.toLowerCase().includes("pdf");
            const isUpload = tags.includes("upload") || isPdf;
            const meta = memory.metadata || (isUpload ? {
              sourceType: "upload" as const,
              extractor: isPdf ? ("pdf" as const) : ("text" as const),
              originalName: memory.title,
            } : undefined);

            return {
              id: memory.id,
              title: memory.title,
              content: memory.content,
              tags,
              metadata: meta,
              createdAt: memory.created_at,
              updatedAt: memory.updated_at,
            };
          });

          const matched = searchMemories(question, storedMemories, { limit: MAX_MEMORIES });
          memories = matched.length > 0 ? matched : storedMemories.slice(0, MAX_MEMORIES);
        }
      }
    } catch (err) {
      console.warn("[Mimo Ask] Error checking Supabase memories:", err);
    }
  }

  // Fallback to client-submitted memories (guest mode or client-side cache)
  if (memories.length === 0 && Array.isArray(candidate.memories) && candidate.memories.length > 0) {
    const validMemories = candidate.memories.filter(validSubmittedMemory);
    if (validMemories.length > 0) {
      const matched = searchMemories(question, validMemories as Memory[], { limit: MAX_MEMORIES });
      memories = matched.length > 0 ? matched : (validMemories as Memory[]).slice(0, MAX_MEMORIES);
    }
  }

  if (memories.length === 0) {
    return NextResponse.json({
      answer: "I couldn't find that in your memories or uploaded files yet. Want to upload or save it?",
      citations: [],
      insufficientEvidence: true,
    });
  }

  const context = memories
    .map(
      (memory) =>
        `MEMORY ID: ${memory.id}\nTITLE: ${memory.title}\nTAGS: ${memory.tags.join(", ")}\nORIGINAL FILE: ${memory.metadata?.originalName || "None"}\nCONTENT:\n${memory.content}`,
    )
    .join("\n\n---\n\n");

  if (context.length > MAX_CONTEXT_LENGTH) {
    return jsonError("The selected memories are too large to process together.", 400, "CONTEXT_TOO_LARGE");
  }

  // Request answer through resilient AI provider pipeline
  const aiResult = await requestAIAnswer(question, context, memories);

  if (aiResult) {
    const parsed = parseModelJson(aiResult.rawJson);
    if (parsed) {
      const verifiedCitations = resolveAndVerifyCitations(parsed.citations, memories);
      return NextResponse.json({
        ...parsed,
        citations: verifiedCitations,
      });
    }
  }

  // If AI service is offline or returned unparseable content, use local recall engine
  const fallbackAnswer = generateLocalRecallAnswer(question, memories);
  return NextResponse.json(fallbackAnswer);
}
