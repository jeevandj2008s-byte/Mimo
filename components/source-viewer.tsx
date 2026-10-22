"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Copy,
  Check,
  Download,
  ExternalLink,
  FileText,
  File,
  ImageIcon,
  Pencil,
  Tag,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import type { Memory } from "@/lib/types";
import { formatMemoryDate } from "./memory-card";
import { attachFileToMemory, resolveFileForMemory, type ResolvedFile } from "@/lib/file-storage";

type SourceViewerProps = {
  memory: Memory | null;
  onClose: () => void;
  onEdit: (memory: Memory) => void;
  onAttach?: (memory: Memory, file: File) => void;
};

export function SourceViewer({ memory, onClose, onEdit, onAttach }: SourceViewerProps) {
  const [file, setFile] = useState<ResolvedFile | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [activeTab, setActiveTab] = useState<"document" | "text">("document");
  const [copied, setCopied] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const attachInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!memory) {
      setFile(null);
      return;
    }

    let active = true;
    setLoadingFile(true);

    const isUploaded =
      memory.metadata?.sourceType === "upload" ||
      memory.tags.includes("upload") ||
      memory.tags.includes("pdf") ||
      memory.title.toLowerCase().includes("pdf") ||
      Boolean(memory.metadata?.originalName);

    setActiveTab(isUploaded ? "document" : "text");

    void (async () => {
      try {
        const resolved = await resolveFileForMemory(memory);
        if (active) setFile(resolved);
      } catch (err) {
        console.warn("Could not load file for memory:", err);
      } finally {
        if (active) setLoadingFile(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [memory]);

  if (!memory) return null;

  const isPdf =
    file?.isPdf ||
    memory.tags.includes("pdf") ||
    memory.metadata?.extractor === "pdf" ||
    memory.title.toLowerCase().includes("pdf") ||
    memory.metadata?.originalName?.toLowerCase().endsWith(".pdf");

  const isImage =
    file?.isImage ||
    memory.metadata?.extractor === "ocr" ||
    /\.(jpg|jpeg|png|webp|gif)$/i.test(memory.metadata?.originalName || "");

  const isAudio =
    file?.isAudio ||
    memory.metadata?.extractor === "audio" ||
    /\.(mp3|wav|webm|m4a)$/i.test(memory.metadata?.originalName || "");

  const hasRealBinary = Boolean(file?.hasRealBinary);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(memory.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access might be denied
    }
  };

  const handleDownload = () => {
    if (!file) return;
    const a = document.createElement("a");
    a.href = file.downloadUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setAttaching(true);
    try {
      const resolved = await attachFileToMemory(memory, selected);
      setFile(resolved);
      setActiveTab("document");
      onAttach?.(memory, selected);
    } catch (err) {
      console.warn("Failed to attach file:", err);
    } finally {
      setAttaching(false);
      if (attachInputRef.current) attachInputRef.current.value = "";
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-[#261b3a]/30 p-0 backdrop-blur-[3px] sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl border border-[#eeeaf5] bg-white shadow-2xl sm:max-w-4xl sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-title"
      >
        {/* Top Header */}
        <div className="border-b border-[#f1eef7] bg-[#fdfcff] px-6 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow">Original memory</span>
                {isPdf && (
                  <span className="rounded-full bg-[#ffebee] px-2.5 py-0.5 text-[10px] font-extrabold text-[#c62828]">
                    PDF DOCUMENT
                  </span>
                )}
                {isImage && (
                  <span className="rounded-full bg-[#e8f5e9] px-2.5 py-0.5 text-[10px] font-extrabold text-[#2e7d32]">
                    IMAGE
                  </span>
                )}
                {isAudio && (
                  <span className="rounded-full bg-[#e3f2fd] px-2.5 py-0.5 text-[10px] font-extrabold text-[#1565c0]">
                    AUDIO RECORDING
                  </span>
                )}
              </div>
              <h2
                className="mt-1.5 truncate text-xl font-extrabold tracking-[-0.03em] text-[#302845] sm:text-2xl"
                id="source-title"
                title={memory.title}
              >
                {memory.title}
              </h2>
              {memory.metadata?.originalName && (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#827a96]">
                  <FileText size={13} className="text-[#8067c0]" />
                  <span>{memory.metadata.originalName}</span>
                  {file?.size ? (
                    <span className="text-[#aaa5b8]">
                      • {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  ) : null}
                </p>
              )}
            </div>

            {/* Top action buttons */}
            <div className="flex shrink-0 items-center gap-2">
              <input
                ref={attachInputRef}
                type="file"
                className="sr-only"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt"
                onChange={handleAttachFile}
              />
              <button
                type="button"
                onClick={() => attachInputRef.current?.click()}
                disabled={attaching}
                className="flex items-center gap-1.5 rounded-xl border border-[#e5dcf7] bg-[#fbf9ff] px-3 py-1.5 text-xs font-bold text-[#6a42b8] shadow-sm transition hover:bg-[#f3edff]"
                title="Attach or replace the original file"
              >
                <Upload size={14} />
                <span className="hidden sm:inline">{hasRealBinary ? "Re-attach" : "Attach File"}</span>
              </button>

              {file && (
                <>
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-[#e5dcf7] bg-[#fbf9ff] px-3 py-1.5 text-xs font-bold text-[#6a42b8] shadow-sm transition hover:bg-[#f3edff]"
                    title="Open in new browser tab"
                  >
                    <ExternalLink size={14} />
                    <span className="hidden sm:inline">Open in Tab</span>
                  </a>
                  <button
                    onClick={handleDownload}
                    type="button"
                    className="flex items-center gap-1.5 rounded-xl border border-[#e5dcf7] bg-[#fbf9ff] px-3 py-1.5 text-xs font-bold text-[#6a42b8] shadow-sm transition hover:bg-[#f3edff]"
                    title="Download file"
                  >
                    <Download size={14} />
                    <span className="hidden sm:inline">Download</span>
                  </button>
                </>
              )}
              <button
                className="quiet-button !rounded-full !p-2"
                onClick={onClose}
                type="button"
                aria-label="Close memory"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Tab buttons */}
          <div className="mt-4 flex gap-2 border-t border-[#f4f1f9] pt-3">
            <button
              type="button"
              onClick={() => setActiveTab("document")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === "document"
                  ? "bg-[#6c48c5] text-white shadow-sm"
                  : "text-[#7a748c] hover:bg-[#f5f1ff] hover:text-[#5c3aa8]"
              }`}
            >
              {isPdf ? (
                <FileText size={14} />
              ) : isImage ? (
                <ImageIcon size={14} />
              ) : isAudio ? (
                <Volume2 size={14} />
              ) : (
                <File size={14} />
              )}
              {isPdf ? "PDF Document" : isImage ? "Image" : isAudio ? "Audio Recording" : "Original Document"}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("text")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === "text"
                  ? "bg-[#6c48c5] text-white shadow-sm"
                  : "text-[#7a748c] hover:bg-[#f5f1ff] hover:text-[#5c3aa8]"
              }`}
            >
              <FileText size={14} />
              Extracted Text & Notes
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7">
          {activeTab === "document" ? (
            <div>
              {loadingFile ? (
                <div className="flex h-64 items-center justify-center text-sm font-semibold text-[#8067c0]">
                  Loading document...
                </div>
              ) : isPdf && hasRealBinary && file ? (
                /* Real PDF Viewer */
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl bg-[#f8f5ff] px-4 py-2.5 text-xs font-semibold text-[#6a42b8]">
                    <span>Viewing PDF: <strong>{file.name}</strong></span>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#6a42b8] underline hover:text-[#5229a4]"
                    >
                      Open full view <ExternalLink size={12} />
                    </a>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-[#eeeaf5] bg-[#525659] shadow-inner">
                    <iframe
                      src={`${file.url}#view=FitH`}
                      title={memory.title}
                      className="h-[60vh] min-h-[480px] w-full border-none"
                    />
                  </div>
                </div>
              ) : isImage && hasRealBinary && file ? (
                /* Real Image Viewer */
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl bg-[#f8f5ff] px-4 py-2 text-xs font-semibold text-[#6a42b8]">
                    <span>Viewing image: <strong>{file.name}</strong></span>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#6a42b8] underline hover:text-[#5229a4]"
                    >
                      View full size <ExternalLink size={12} />
                    </a>
                  </div>
                  <div className="flex max-h-[60vh] items-center justify-center overflow-hidden rounded-2xl border border-[#eeeaf5] bg-[#faf8fd] p-4">
                    <img
                      src={file.url}
                      alt={memory.title}
                      className="max-h-[52vh] max-w-full rounded-xl object-contain shadow-md"
                    />
                  </div>
                </div>
              ) : isAudio && hasRealBinary && file ? (
                /* Real Audio Player */
                <div className="rounded-2xl border border-[#eeeaf5] bg-[#fbfaff] p-8 text-center">
                  <Volume2 size={36} className="mx-auto text-[#7354c7]" />
                  <p className="mt-3 text-sm font-bold text-[#302845]">{file.name}</p>
                  <audio controls src={file.url} className="mx-auto mt-5 w-full max-w-md" />
                </div>
              ) : (
                /* Document file not in browser cache yet - Provide 1-click Attach dropzone */
                <div className="space-y-4">
                  <div className="rounded-2xl border-2 border-dashed border-[#d5c7ff] bg-[#fbfaff] p-8 text-center">
                    <FileText className="mx-auto h-12 w-12 text-[#7354c7]" />
                    <h3 className="mt-3 text-base font-bold text-[#302845]">
                      {isPdf ? "Attach your PDF to view live pages" : "Attach original document"}
                    </h3>
                    <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-[#827a96]">
                      You uploaded this memory previously. Attach your <strong>{memory.metadata?.originalName || memory.title}</strong> file once to view and scroll the original pages right here in Mimo!
                    </p>
                    <div className="mt-5 flex justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => attachInputRef.current?.click()}
                        disabled={attaching}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#6c48c5] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#5b38b2]"
                      >
                        <Upload size={14} />
                        {attaching ? "Attaching file..." : "Choose File to View"}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#eeeaf5] bg-white px-3.5 py-2 text-xs font-bold text-[#5c40a8] shadow-sm hover:bg-[#fcfaff]"
                      >
                        <Download size={14} /> Download Extracted Text
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#eeeaf5] bg-[#fbfaff] p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#8b849c]">Extracted Content</p>
                    <p className="mt-2 whitespace-pre-wrap text-[14px] leading-6 text-[#453e58]">{memory.content}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Text tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#817b96]">
                  {memory.content.split(/\s+/).filter(Boolean).length} words
                </span>
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="flex items-center gap-1 text-xs font-bold text-[#7354c7] transition hover:text-[#5229a4]"
                >
                  {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  <span>{copied ? "Copied!" : "Copy text"}</span>
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto rounded-2xl border border-[#f0ebf8] bg-[#fbfaff] p-6">
                <p className="whitespace-pre-wrap text-[15px] leading-7 text-[#403953] selection:bg-[#dfd3ff]">
                  {memory.content}
                </p>
              </div>
            </div>
          )}

          {/* Tags and Metadata info */}
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-[#f4f1f9] pt-4 text-xs text-[#928ca3]">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={14} /> Updated {formatMemoryDate(memory.updatedAt)}
            </span>
            {memory.tags.length ? <span className="text-[#d5cfe1]">•</span> : null}
            {memory.tags.length ? (
              <span className="flex items-center gap-1.5">
                <Tag size={14} /> {memory.tags.join(", ")}
              </span>
            ) : null}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-[#f1eef7] bg-[#fdfcff] px-6 py-4 sm:px-8">
          <div className="text-xs text-[#8c859d]">
            {isPdf ? "PDF Document in Mimo" : isImage ? "Image in Mimo" : "Memory in Mimo"}
          </div>
          <div className="flex items-center gap-2">
            <button className="quiet-button" onClick={() => onEdit(memory)} type="button">
              <Pencil size={15} /> Edit text
            </button>
            <button
              onClick={onClose}
              type="button"
              className="rounded-xl bg-[#6c48c5] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#5b38b2]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
