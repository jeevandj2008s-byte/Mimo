"use client";

import { ArrowUp, Paperclip, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { appendSpeechText } from "@/lib/speech";
import { SpeechInputButton } from "./speech-input-button";

type AskPanelProps = {
  question: string;
  onQuestionChange: (question: string) => void;
  onAsk: () => void;
  loading: boolean;
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
};

export function AskPanel({ question, onQuestionChange, onAsk, loading, onUpload, uploading }: AskPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setSelectedFilename(file.name);
    try {
      await onUpload(file);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
          <input ref={fileInputRef} className="sr-only" accept=".pdf,.txt,.md,.docx,.jpg,.jpeg,.png,.webp,.webm,.wav,.mp3" onChange={(event) => void handleFile(event.target.files?.[0])} type="file" />
          <button className="flex h-9 items-center gap-1.5 rounded-xl bg-[#f5f1ff] px-2.5 text-[11px] font-bold text-[#7354c7] transition hover:bg-[#e8e0ff] disabled:cursor-not-allowed disabled:opacity-50" disabled={loading || uploading} onClick={() => fileInputRef.current?.click()} type="button" aria-label="Upload a file">
            <Paperclip size={15} />
            <span className="hidden sm:inline">Upload</span>
          </button>
          <SpeechInputButton disabled={loading || uploading} label="Voice" onTranscript={(transcript) => onQuestionChange(appendSpeechText(question, transcript))} />
        </div>
        <button className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#7354c7] text-white transition hover:bg-[#5c40a8] disabled:cursor-not-allowed disabled:bg-[#d5c7ff]" disabled={loading || uploading || !question.trim()} onClick={onAsk} type="button" aria-label="Ask Mimo">
          <ArrowUp size={17} />
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] font-medium text-[#aaa5b8]">
        <span>{uploading ? `Processing ${selectedFilename ?? "file"}...` : selectedFilename ? `${selectedFilename} added to your memories` : "Tip: use Voice or Upload, then ask Mimo"}</span>
        <span>{question.length}/500</span>
      </div>
    </section>
  );
}
