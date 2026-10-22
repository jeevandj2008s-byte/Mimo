import type { Memory, RecallAnswer } from "./types";

export type AIProviderConfig = {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  supportsJsonSchema?: boolean;
};

function isValidApiKey(key: string | undefined): key is string {
  if (!key) return false;
  const trimmed = key.trim();
  return (
    trimmed.length > 10 &&
    !trimmed.includes("your-key") &&
    !trimmed.includes("placeholder") &&
    !trimmed.includes("sk-your-")
  );
}

export function getAvailableProviders(): AIProviderConfig[] {
  const providers: AIProviderConfig[] = [];

  const groqKey = process.env.GROQ_API_KEY;
  if (isValidApiKey(groqKey)) {
    providers.push({
      name: "Groq",
      baseUrl: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: groqKey.trim(),
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      supportsJsonSchema: false,
    });
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (isValidApiKey(openrouterKey)) {
    providers.push({
      name: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: openrouterKey.trim(),
      model: process.env.OPENROUTER_MODEL || "minimax/minimax-m3.1-flash:free",
      supportsJsonSchema: false,
    });
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (isValidApiKey(openaiKey)) {
    providers.push({
      name: "OpenAI",
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: openaiKey.trim(),
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      supportsJsonSchema: true,
    });
  }

  return providers;
}

const SYSTEM_INSTRUCTION = `You are Mimo, a personal recall and document assistant.
Your main job is to help users remember, find, and recall their saved notes, documents, and uploaded files (such as PDFs, physics notes, priorities, project decisions, etc.).

Guidelines:
1. When a user asks about or asks for a document/file (e.g., "where is my phy pdf", "can I have my physics document", "next week priorities"):
   - Identify the matching memory or uploaded file.
   - Return a clear, helpful response explaining what document was found, its title, what it contains or its key points, and that they can open/view it below.
2. For specific questions, answer directly using only the supplied saved memories.
3. For every citation, provide a short exact excerpt from the referenced memory content.
4. If the supplied memories do not sufficiently support an answer, state that the information could not be found.
5. Return ONLY a valid JSON object with this exact shape:
{
  "answer": "string",
  "citations": [
    {
      "memoryId": "string",
      "quote": "short exact quote from memory content"
    }
  ],
  "insufficientEvidence": false
}`;

export async function requestAIAnswer(
  question: string,
  context: string,
  memories: Memory[],
  timeoutMs = 20_000,
): Promise<{ rawJson: string; providerName: string } | null> {
  const providers = getAvailableProviders();

  for (const provider of providers) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const requestBody: Record<string, unknown> = {
        model: provider.model,
        temperature: 0.1,
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          {
            role: "user",
            content: `User query / question:\n${question}\n\nSupplied saved memories:\n${context}\n\nRemember to return ONLY the JSON object.`,
          },
        ],
      };

      if (provider.supportsJsonSchema) {
        requestBody.response_format = {
          type: "json_schema",
          json_schema: {
            name: "mimo_recall_answer",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                answer: { type: "string" },
                citations: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      memoryId: { type: "string" },
                      quote: { type: "string" },
                    },
                    required: ["memoryId", "quote"],
                  },
                },
                insufficientEvidence: { type: "boolean" },
              },
              required: ["answer", "citations", "insufficientEvidence"],
            },
          },
        };
      } else {
        requestBody.response_format = { type: "json_object" };
      }

      const response = await fetch(provider.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.warn(`[Mimo AI] Provider ${provider.name} failed with HTTP ${response.status}. Trying next provider.`);
        continue;
      }

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>;
      };

      const content = body.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.trim()) {
        return { rawJson: content.trim(), providerName: provider.name };
      }
    } catch (err) {
      console.warn(`[Mimo AI] Error calling ${provider.name}:`, err);
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

/**
 * Intelligent local recall fallback when external AI providers are unavailable.
 * Ensures the user's PDF / document or memory is ALWAYS successfully recalled and returned!
 */
export function generateLocalRecallAnswer(question: string, memories: Memory[]): RecallAnswer {
  if (!memories.length) {
    return {
      answer: "I couldn't find that in your memories or uploaded files yet. Want to save or upload it?",
      citations: [],
      insufficientEvidence: true,
    };
  }

  const topMemory = memories[0];
  const isDocumentRequest =
    /where|find|get|show|return|open|view|have|look|pdf|file|doc|notes|document/i.test(question);

  // Pick a concise representative sentence or snippet from the top memory
  const sentences = topMemory.content
    .split(/(?<=[.?!])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  const excerpt = sentences[0] || topMemory.content.slice(0, 180);

  let answerText: string;
  if (isDocumentRequest) {
    const docType = topMemory.metadata?.extractor?.toUpperCase() || (topMemory.tags.includes("pdf") ? "PDF" : "document");
    answerText = `Here is your ${docType} **"${topMemory.title}"**! ${topMemory.metadata?.originalName ? `(File: ${topMemory.metadata.originalName})` : ""}\n\n${excerpt}\n\nYou can view the full contents in the source card below.`;
  } else {
    answerText = `Based on your note **"${topMemory.title}"**: ${excerpt}`;
  }

  return {
    answer: answerText,
    citations: [{ memoryId: topMemory.id, quote: excerpt }],
    insufficientEvidence: false,
  };
}

