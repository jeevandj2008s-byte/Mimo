"use client";

import { CalendarDays, FileText, Pencil, Tag, X } from "lucide-react";
import type { Memory } from "@/lib/types";
import { formatMemoryDate } from "./memory-card";

type SourceViewerProps = {
  memory: Memory | null;
  onClose: () => void;
  onEdit: (memory: Memory) => void;
};

export function SourceViewer({ memory, onClose, onEdit }: SourceViewerProps) {
  if (!memory) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#261b3a]/25 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl border border-[#eeeaf5] bg-white p-6 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-8" role="dialog" aria-modal="true" aria-labelledby="source-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Original memory</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[#302845]" id="source-title">{memory.title}</h2>
          </div>
          <button className="quiet-button !rounded-full !p-2" onClick={onClose} type="button" aria-label="Close memory"><X size={16} /></button>
        </div>
        <div className="mt-6 rounded-2xl bg-[#fbfaff] p-5">
          <p className="whitespace-pre-wrap text-[15px] leading-7 text-[#4f4964]">{memory.content}</p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-[#928ca3]">
          <span className="flex items-center gap-1.5"><CalendarDays size={14} /> Updated {formatMemoryDate(memory.updatedAt)}</span>
          {memory.tags.length ? <span className="text-[#d5cfe1]">•</span> : null}
          {memory.tags.length ? <span className="flex items-center gap-1.5"><Tag size={14} /> {memory.tags.join(", ")}</span> : null}
        </div>
        {memory.metadata?.originalName ? <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#f5f1ff] px-3 py-2 text-xs font-semibold text-[#7354c7]"><FileText size={14} /> Imported from {memory.metadata.originalName}{memory.metadata.chunkCount && memory.metadata.chunkCount > 1 ? ` · part ${(memory.metadata.chunkIndex ?? 0) + 1} of ${memory.metadata.chunkCount}` : ""}</div> : null}
        <div className="mt-6 flex justify-end border-t border-[#f1eef7] pt-5">
          <button className="quiet-button" onClick={() => onEdit(memory)} type="button"><Pencil size={15} /> Edit memory</button>
        </div>
      </div>
    </div>
  );
}
