"use client";

import type { Memory } from "./types";

const DB_NAME = "mimo_file_vault_v1";
const STORE_NAME = "files";

type VaultRecord = {
  key: string;
  blob: Blob;
  name: string;
  type: string;
  size: number;
  updatedAt: string;
};

function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveFileToVault(
  key: string,
  fileOrBlob: File | Blob,
  name: string,
  mimeType: string,
): Promise<void> {
  const db = await openDB();
  if (!db) return;

  const normalizedKey = key.trim().toLowerCase();

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const record: VaultRecord = {
        key: normalizedKey,
        blob: fileOrBlob,
        name,
        type: mimeType || fileOrBlob.type || "application/octet-stream",
        size: fileOrBlob.size,
        updatedAt: new Date().toISOString(),
      };
      store.put(record);
      // Also store by exact key if casing differed
      if (key !== normalizedKey) {
        store.put({ ...record, key });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getFileFromVault(key: string): Promise<VaultRecord | null> {
  const db = await openDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);

      // Try exact key first
      const req1 = store.get(key);
      req1.onsuccess = () => {
        if (req1.result) {
          resolve(req1.result as VaultRecord);
          return;
        }
        // Try normalized lowercase key
        const lowerKey = key.trim().toLowerCase();
        const req2 = store.get(lowerKey);
        req2.onsuccess = () => resolve((req2.result as VaultRecord) || null);
        req2.onerror = () => resolve(null);
      };
      req1.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function base64ToBlob(dataUrl: string): Blob | null {
  try {
    const [header, base64] = dataUrl.split(",");
    if (!base64) return null;
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

export type ResolvedFile = {
  url: string;
  name: string;
  type: string;
  size?: number;
  isPdf: boolean;
  isImage: boolean;
  isAudio: boolean;
  downloadUrl: string;
  hasRealBinary: boolean;
};

export async function resolveFileForMemory(memory: Memory): Promise<ResolvedFile | null> {
  const meta = memory.metadata;
  const fileName = meta?.originalName || memory.title || "document";
  const ext = fileName.toLowerCase().split(".").pop() || "";
  const isPdf =
    ext === "pdf" ||
    meta?.extractor === "pdf" ||
    memory.tags.includes("pdf") ||
    memory.title.toLowerCase().includes("pdf");

  const isImage =
    ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ||
    meta?.extractor === "ocr" ||
    memory.tags.some((t) => ["jpg", "jpeg", "png", "webp", "image"].includes(t));

  const isAudio =
    ["mp3", "wav", "webm", "m4a"].includes(ext) ||
    meta?.extractor === "audio" ||
    memory.tags.some((t) => ["audio", "voice", "recording"].includes(t));

  const defaultMime = isPdf
    ? "application/pdf"
    : isImage
      ? `image/${ext === "jpg" ? "jpeg" : ext}`
      : isAudio
        ? `audio/${ext}`
        : meta?.mimeType || "application/octet-stream";

  // 1. Check IndexedDB by memory ID
  let vaultItem = await getFileFromVault(memory.id);

  // 2. Check IndexedDB by sourceId
  if (!vaultItem && meta?.sourceId) {
    vaultItem = await getFileFromVault(meta.sourceId);
  }

  // 3. Check IndexedDB by originalName
  if (!vaultItem && meta?.originalName) {
    vaultItem = await getFileFromVault(meta.originalName);
  }

  // 4. Check IndexedDB by memory title
  if (!vaultItem && memory.title) {
    vaultItem = await getFileFromVault(memory.title);
  }

  if (vaultItem && vaultItem.blob) {
    const url = URL.createObjectURL(vaultItem.blob);
    return {
      url,
      downloadUrl: url,
      name: vaultItem.name || fileName,
      type: vaultItem.type || defaultMime,
      size: vaultItem.size,
      isPdf,
      isImage,
      isAudio,
      hasRealBinary: true,
    };
  }

  // 5. Check base64 fileData in metadata
  if (meta?.fileData) {
    const blob = base64ToBlob(meta.fileData);
    if (blob) {
      const url = URL.createObjectURL(blob);
      return {
        url,
        downloadUrl: url,
        name: fileName,
        type: blob.type || defaultMime,
        size: blob.size,
        isPdf,
        isImage,
        isAudio,
        hasRealBinary: true,
      };
    }
    return {
      url: meta.fileData,
      downloadUrl: meta.fileData,
      name: fileName,
      type: defaultMime,
      size: meta.byteSize,
      isPdf,
      isImage,
      isAudio,
      hasRealBinary: true,
    };
  }

  // 6. Synthesized text fallback
  if (memory.content) {
    const textBlob = new Blob([memory.content], { type: "text/plain;charset=utf-8" });
    const textUrl = URL.createObjectURL(textBlob);
    return {
      url: textUrl,
      downloadUrl: textUrl,
      name: `${fileName.replace(/\.[^.]+$/, "")}.txt`,
      type: "text/plain",
      size: textBlob.size,
      isPdf,
      isImage,
      isAudio,
      hasRealBinary: false, // Flag that binary file is not attached yet
    };
  }

  return null;
}

export async function attachFileToMemory(memory: Memory, file: File): Promise<ResolvedFile> {
  const mime = file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "application/octet-stream");

  // Save by multiple keys for guaranteed lookup
  await saveFileToVault(memory.id, file, file.name, mime);
  if (memory.title) {
    await saveFileToVault(memory.title, file, file.name, mime);
  }
  if (memory.metadata?.originalName) {
    await saveFileToVault(memory.metadata.originalName, file, file.name, mime);
  }
  await saveFileToVault(file.name, file, file.name, mime);

  const url = URL.createObjectURL(file);
  const ext = file.name.toLowerCase().split(".").pop() || "";
  const isPdf = ext === "pdf" || mime === "application/pdf";
  const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) || mime.startsWith("image/");
  const isAudio = ["mp3", "wav", "webm", "m4a"].includes(ext) || mime.startsWith("audio/");

  return {
    url,
    downloadUrl: url,
    name: file.name,
    type: mime,
    size: file.size,
    isPdf,
    isImage,
    isAudio,
    hasRealBinary: true,
  };
}
