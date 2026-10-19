"use client";

import { ArrowUpRight, Quote } from "lucide-react";
import type { Memory, MemoryCitation } from "@/lib/types";

type SourceCitationProps = {
  citation: MemoryCitation;
  memory?: Memory;
  onOpen: (memory: Memory) => void;
};

export function SourceCitation({ citation, memory, onOpen }: SourceCitationProps) {
  if (!memory || !memory.content.includes(citation.quote)) return null;
  return (
    <button className="group w-full rounded-2xl border border-[#eeeaf5] bg-white p-4 text-left transition hover:border-[#d5c7ff] hover:bg-[#fbfaff]" onClick={() => onOpen(memory)} type="button">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f5f1ff] text-[#8067c0]"><Quote size={13} fill="currentColor" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-bold text-[#5c40a8]">{memory.title}</p>
            <ArrowUpRight className="shrink-0 text-[#aaa5b8] transition group-hover:text-[#7354c7]" size={15} />
          </div>
          <p className="mt-2 text-xs leading-5 text-[#716b82]">“{citation.quote}”</p>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#aaa5b8]">Open original memory</p>
        </div>
      </div>
    </button>
  );
}
