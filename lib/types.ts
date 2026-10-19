export type Memory = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
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
};

export type RetrievalOptions = {
  limit?: number;
  threshold?: number;
};

export type ApiError = {
  error: string;
  code?: string;
};
