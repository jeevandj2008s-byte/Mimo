import mammoth from "mammoth";
import type { MemoryExtractor, MemoryInput, MemoryMetadata } from "./types";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_MEMORY_CHUNK_LENGTH = 7800;

const EXTENSIONS = new Set(["pdf", "txt", "md", "docx", "jpg", "jpeg", "png", "webp", "webm", "wav", "mp3"]);

export type FileExtractionErrorCode =
  | "INVALID_FILE"
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "EMPTY_EXTRACTED_TEXT"
  | "EXTRACTION_FAILED"
  | "MISSING_API_KEY"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_ERROR";

export class FileExtractionError extends Error {
  constructor(public readonly code: FileExtractionErrorCode, message: string) {
    super(message);
    this.name = "FileExtractionError";
  }
}

export type ExtractedUpload = {
  input: MemoryInput;
  sourceId: string;
  chunkCount: number;
};

function extensionOf(name: string): string {
  return name.toLowerCase().split(".").pop() ?? "";
}

function safeFilename(name: string): string {
  const cleaned = name.replace(/[\\/\0\r\n]+/g, "_").replace(/[^a-zA-Z0-9._ -]/g, "_").trim();
  return (cleaned || "uploaded-memory").slice(0, 160);
}

function titleFromFilename(name: string): string {
  const withoutExtension = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return (withoutExtension || "Uploaded memory").slice(0, 120);
}

function mimeMatchesExtension(extension: string, mime: string): boolean {
  if (!mime || mime === "application/octet-stream") return true;
  const allowed: Record<string, string[]> = {
    pdf: ["application/pdf"],
    txt: ["text/plain"],
    md: ["text/markdown", "text/plain"],
    docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"],
    jpg: ["image/jpeg"],
    jpeg: ["image/jpeg"],
    png: ["image/png"],
    webp: ["image/webp"],
    webm: ["audio/webm", "video/webm"],
    wav: ["audio/wav", "audio/x-wav", "audio/wave"],
    mp3: ["audio/mpeg", "audio/mp3"],
  };
  return allowed[extension]?.includes(mime) ?? false;
}

function hasMagic(extension: string, bytes: Uint8Array): boolean {
  const startsWith = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (extension === "pdf") return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  if (extension === "docx") return startsWith(0x50, 0x4b, 0x03, 0x04);
  if (extension === "png") return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (extension === "jpg" || extension === "jpeg") return startsWith(0xff, 0xd8, 0xff);
  if (extension === "webp") return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (extension === "wav") return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WAVE";
  if (extension === "webm") return startsWith(0x1a, 0x45, 0xdf, 0xa3);
  if (extension === "mp3") return new TextDecoder().decode(bytes.slice(0, 3)) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  return true;
}

function normalizeText(text: string): string {
  return text.replace(/\u0000/g, "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function splitExtractedText(text: string, maxLength = MAX_MEMORY_CHUNK_LENGTH): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const chunks: string[] = [];
  let remaining = normalized;
  while (remaining.length > maxLength) {
    const paragraphBreak = remaining.lastIndexOf("\n\n", maxLength);
    const lineBreak = remaining.lastIndexOf("\n", maxLength);
    const space = remaining.lastIndexOf(" ", maxLength);
    const cut = Math.max(paragraphBreak, lineBreak, space);
    const boundary = cut > Math.floor(maxLength * 0.55) ? cut : maxLength;
    chunks.push(remaining.slice(0, boundary).trim());
    remaining = remaining.slice(boundary).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks.filter(Boolean);
}

function metadataFor(file: File, extractor: MemoryExtractor, sourceId: string, chunkIndex: number, chunkCount: number): MemoryMetadata {
  return {
    sourceType: "upload",
    originalName: safeFilename(file.name),
    mimeType: file.type || "application/octet-stream",
    byteSize: file.size,
    extractor,
    sourceId,
    chunkIndex,
    chunkCount,
    uploadedAt: new Date().toISOString(),
  };
}

export async function transcribeAudioFile(file: File): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new FileExtractionError("MISSING_API_KEY", "Audio uploads need OPENAI_API_KEY on the server for transcription.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const body = new FormData();
  body.append("file", new Blob([Uint8Array.from(buffer)], { type: file.type || "audio/mpeg" }), safeFilename(file.name));
  body.append("model", "whisper-1");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
      signal: controller.signal,
    });
    if (!response.ok) throw new FileExtractionError("PROVIDER_ERROR", "The audio transcription service could not process this recording.");
    const result = await response.json() as { text?: unknown };
    return typeof result.text === "string" ? result.text : "";
  } catch (error) {
    if (error instanceof FileExtractionError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new FileExtractionError("PROVIDER_TIMEOUT", "Audio transcription took too long. Try a shorter recording.");
    throw new FileExtractionError("PROVIDER_ERROR", "The audio transcription service could not be reached.");
  } finally {
    clearTimeout(timeout);
  }
}

async function extractImageText(file: File, buffer: Buffer): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new FileExtractionError("MISSING_API_KEY", "Image uploads need OPENAI_API_KEY on the server for OCR.");
  const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0,
        messages: [{ role: "user", content: [{ type: "text", text: "Extract only readable text from this image. If there is no readable text, say that no readable text was found. Do not invent details." }, { type: "image_url", image_url: { url: dataUrl } }] }],
      }),
    });
    if (!response.ok) throw new FileExtractionError("PROVIDER_ERROR", "The image OCR service could not process this image.");
    const result = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = result.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : "";
  } catch (error) {
    if (error instanceof FileExtractionError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new FileExtractionError("PROVIDER_TIMEOUT", "Image OCR took too long. Try a smaller image.");
    throw new FileExtractionError("PROVIDER_ERROR", "The image OCR service could not be reached.");
  } finally {
    clearTimeout(timeout);
  }
}

async function extractContent(file: File, extension: string, buffer: Buffer): Promise<{ text: string; extractor: MemoryExtractor }> {
  if (extension === "txt" || extension === "md") return { text: buffer.toString("utf8"), extractor: "text" };
  if (extension === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, extractor: "docx" };
  }
  if (extension === "pdf") {
    // pdf-parse pulls pdfjs into a server-only chunk. Keep it out of the
    // route's eager module graph so the upload endpoint can still return a
    // clean auth/configuration response before parsing any PDF.
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const pages = result.pages.map((page) => `[Page ${page.num}]\n${page.text}`).join("\n\n");
      return { text: pages || result.text, extractor: "pdf" };
    } finally {
      await parser.destroy();
    }
  }
  if (["jpg", "jpeg", "png", "webp"].includes(extension)) return { text: await extractImageText(file, buffer), extractor: "ocr" };
  if (["webm", "wav", "mp3"].includes(extension)) return { text: await transcribeAudioFile(file), extractor: "audio" };
  throw new FileExtractionError("UNSUPPORTED_FILE_TYPE", "This file type is not supported.");
}

export async function extractUpload(file: File): Promise<ExtractedUpload[]> {
  if (!file || !file.name) throw new FileExtractionError("INVALID_FILE", "Choose a file to upload.");
  const extension = extensionOf(file.name);
  if (!EXTENSIONS.has(extension) || !mimeMatchesExtension(extension, file.type)) throw new FileExtractionError("UNSUPPORTED_FILE_TYPE", "Supported files are PDF, TXT, Markdown, DOCX, images, and audio recordings.");
  if (file.size <= 0) throw new FileExtractionError("INVALID_FILE", "This file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new FileExtractionError("FILE_TOO_LARGE", "Files must be 15 MB or smaller.");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!hasMagic(extension, buffer)) throw new FileExtractionError("INVALID_FILE", "The file contents do not match its extension.");

  const { text, extractor } = await extractContent(file, extension, buffer);
  const chunks = splitExtractedText(text);
  if (!chunks.length) throw new FileExtractionError("EMPTY_EXTRACTED_TEXT", "Mimo could not find readable text in this file.");
  const sourceId = crypto.randomUUID();
  const title = titleFromFilename(safeFilename(file.name));
  return chunks.map((content, index) => ({
    input: {
      title: chunks.length > 1 ? `${title} — part ${index + 1}` : title,
      content,
      tags: ["upload", extension],
      metadata: metadataFor(file, extractor, sourceId, index, chunks.length),
    },
    sourceId,
    chunkCount: chunks.length,
  }));
}
