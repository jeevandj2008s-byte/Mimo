"use client";

import { ArrowUp, Sparkles } from "lucide-react";

type AskPanelProps = {
  question: string;
  onQuestionChange: (question: string) => void;
  onAsk: () => void;
  loading: boolean;
};

export function AskPanel({ question, onQuestionChange, onAsk, loading }: AskPanelProps) {
  return (
    <section className="surface overflow-hidden border-[#e8e0ff] bg-[linear-gradient(135deg,#fff_0%,#fbfaff_100%)] p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eee7ff] text-[#7354c7]"><Sparkles size={19} /></div>
        <div>
          <p className="eyebrow">Ask your little memory buddy</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-[#302845] sm:text-2xl">What are you trying to remember?</h2>
          <p className="mt-1.5 text-sm leading-6 text-[#817b96]">Ask naturally. Mimo will search your notes and show you exactly where the answer came from.</p>
        </div>
      </div>
      <div className="relative mt-6">
        <textarea
          aria-label="Ask Mimo a question"
          className="field min-h-[108px] resize-none pr-14 text-[15px] leading-6 shadow-sm"
          maxLength={500}
          onChange={(event) => onQuestionChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onAsk();
          }}
          placeholder="e.g. What did I decide to build first for my AI project, and why?"
          value={question}
        />
        <button className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#7354c7] text-white transition hover:bg-[#5c40a8] disabled:cursor-not-allowed disabled:bg-[#d5c7ff]" disabled={loading || !question.trim()} onClick={onAsk} type="button" aria-label="Ask Mimo">
          <ArrowUp size={17} />
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] font-medium text-[#aaa5b8]">
        <span>Tip: press ⌘ / Ctrl + Enter to ask</span>
        <span>{question.length}/500</span>
      </div>
    </section>
  );
}
