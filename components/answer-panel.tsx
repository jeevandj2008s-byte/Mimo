"use client";

import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import type { Memory, RecallAnswer } from "@/lib/types";
import { SourceCitation } from "./source-citation";

type AnswerPanelProps = {
  answer: RecallAnswer | null;
  loading: boolean;
  error: string | null;
  memories: Memory[];
  onOpenMemory: (memory: Memory) => void;
  onSaveFromQuestion: () => void;
};

export function AnswerPanel({ answer, loading, error, memories, onOpenMemory, onSaveFromQuestion }: AnswerPanelProps) {
  if (loading) {
    return (
      <section className="surface p-6 sm:p-7" aria-live="polite" aria-busy="true">
        <div className="flex items-center gap-3"><Loader2 className="animate-spin text-[#7354c7]" size={19} /><p className="text-sm font-bold text-[#5d5871]">Mimo is looking through your memories...</p></div>
        <div className="mt-6 space-y-3"><div className="h-4 w-4/5 animate-pulse rounded bg-[#f5f1ff]" /><div className="h-4 w-full animate-pulse rounded bg-[#f5f1ff]" /><div className="h-4 w-2/3 animate-pulse rounded bg-[#f5f1ff]" /></div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="surface border-[#ffd9e4] bg-[#fff8fa] p-6 sm:p-7" aria-live="polite">
        <div className="flex items-start gap-3"><AlertCircle className="mt-0.5 shrink-0 text-[#bd6c8d]" size={20} /><div><h2 className="text-sm font-bold text-[#69475a]">Mimo couldn’t answer that yet</h2><p className="mt-1 text-sm leading-6 text-[#a27b8b]">{error}</p></div></div>
      </section>
    );
  }

  if (!answer) {
    return (
      <section className="surface border-dashed bg-[#fcfbff] p-6 sm:p-7">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-[#b8a2f5]" size={20} /><div><h2 className="text-sm font-bold text-[#5d5871]">Every answer comes with receipts</h2><p className="mt-1 text-sm leading-6 text-[#9992aa]">Ask a question above and Mimo will connect the dots only when your saved memories support it.</p></div></div>
      </section>
    );
  }

  if (answer.insufficientEvidence) {
    return (
      <section className="surface border-[#ffd9e4] bg-[#fff8fa] p-6 sm:p-7" aria-live="polite">
        <div className="flex items-start gap-3"><span className="text-2xl" aria-hidden="true">🌙</span><div><p className="eyebrow !text-[#bd6c8d]">Not enough evidence</p><h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-[#69475a]">I couldn’t find that in your memories yet.</h2><p className="mt-2 text-sm leading-6 text-[#a27b8b]">{answer.answer || "Want to save it?"}</p><button className="mt-4 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-[#bd6c8d] shadow-sm ring-1 ring-[#ffd9e4] transition hover:bg-[#fff0f4]" onClick={onSaveFromQuestion} type="button">Want to save it?</button></div></div>
      </section>
    );
  }

  const verifiedCitations = answer.citations.filter((citation) => {
    const memory = memories.find((candidate) => candidate.id === citation.memoryId);
    return memory?.content.includes(citation.quote);
  });

  return (
    <section className="surface overflow-hidden" aria-live="polite">
      <div className="border-b border-[#f1eef7] bg-[#fcfbff] px-6 py-5 sm:px-7">
        <div className="flex items-center gap-2 text-[#5c40a8]"><CheckCircle2 size={17} /><p className="text-xs font-bold">Here’s what you decided — and the note that proves it.</p></div>
      </div>
      <div className="p-6 sm:p-7">
        <p className="whitespace-pre-wrap text-[16px] leading-8 text-[#4b455f]">{answer.answer}</p>
        {verifiedCitations.length > 0 ? (
          <div className="mt-7 border-t border-[#f1eef7] pt-6">
            <div className="mb-3 flex items-center justify-between"><p className="eyebrow">Evidence from your memories</p><span className="rounded-full bg-[#f5f1ff] px-2.5 py-1 text-[10px] font-bold text-[#7354c7]">{verifiedCitations.length} verified source{verifiedCitations.length === 1 ? "" : "s"}</span></div>
            <div className="space-y-2.5">
              {verifiedCitations.map((citation) => <SourceCitation citation={citation} key={`${citation.memoryId}-${citation.quote}`} memory={memories.find((memory) => memory.id === citation.memoryId)} onOpen={onOpenMemory} />)}
            </div>
          </div>
        ) : <p className="mt-6 rounded-xl bg-[#fff8fa] p-3 text-xs font-semibold text-[#a27b8b]">Mimo’s answer did not include a verifiable source, so it has not been presented as evidence.</p>}
      </div>
    </section>
  );
}
