export type Memory = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  metadata?: MemoryMetadata;
};

export type MemorySourceType = "manual" | "voice" | "upload";

export type MemoryExtractor = "text" | "pdf" | "docx" | "ocr" | "audio";

export type MemoryMetadata = {
  sourceType?: MemorySourceType;
  originalName?: string;
  mimeType?: string;
  byteSize?: number;
  extractor?: MemoryExtractor;
  sourceId?: string;
  chunkIndex?: number;
  chunkCount?: number;
  uploadedAt?: string;
};

export type MemoryCitation = {
  memoryId: string;
  quote: string;
};

export type RecallAnswer = {
  answer: string;
  citations: MemoryCitation[];
  insufficientEvidence: boolean;
};

export type MemoryInput = {
  title: string;
  content: string;
  tags: string[];
  metadata?: MemoryMetadata;
};

export type RetrievalOptions = {
  limit?: number;
  threshold?: number;
};

export type ApiError = {
  error: string;
  code?: string;
};
