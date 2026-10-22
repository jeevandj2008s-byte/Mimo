"use client";

import { useEffect, useState } from "react";
import { Check, FileUp, X } from "lucide-react";
import type { Memory, MemoryInput } from "@/lib/types";
import { validateMemoryInput, type MemoryValidationErrors } from "@/lib/validation";
import { appendSpeechText } from "@/lib/speech";
import { SpeechInputButton } from "./speech-input-button";

type CaptureMemoryDialogProps = {
  open: boolean;
  memory?: Memory | null;
  onClose: () => void;
  onSave: (input: MemoryInput) => void | Promise<void>;
  onUpload: (file: File) => Promise<void>;
  uploading?: boolean;
};

export function CaptureMemoryDialog({ open, memory, onClose, onSave, onUpload, uploading = false }: CaptureMemoryDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [errors, setErrors] = useState<MemoryValidationErrors>({});
  const [saving, setSaving] = useState(false);
  const [voiceUsed, setVoiceUsed] = useState(false);
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(memory?.title ?? "");
    setContent(memory?.content ?? "");
    setTags(memory?.tags.join(", ") ?? "");
    setErrors({});
    setVoiceUsed(false);
    setSelectedFilename(null);
  }, [open, memory]);

  if (!open) return null;

  const isEditing = Boolean(memory);
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateMemoryInput({
      title,
      content,
      tags: tags.split(","),
      metadata: memory?.metadata,
    });
    setErrors(result.errors);
    if (!result.valid || !result.value) return;
    setSaving(true);
    try {
      await onSave({
        ...result.value,
        metadata: {
          ...memory?.metadata,
          ...(voiceUsed ? { sourceType: "voice", extractor: "text" } : {}),
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.currentTarget.value = "";
    setSelectedFilename(file.name);
    try {
      await onUpload(file);
      onClose();
    } catch {
      // Keep dialog open if upload failed
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#261b3a]/25 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-[#eeeaf5] bg-white p-6 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="memory-dialog-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{isEditing ? "Refine a memory" : "New memory"}</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-[#302845]" id="memory-dialog-title">{isEditing ? "Edit this note" : "What should Mimo remember?"}</h2>
            <p className="mt-2 text-sm leading-6 text-[#817b96]">Capture the detail now, so future-you can find it in a few words.</p>
          </div>
          <button className="quiet-button !rounded-full !p-2" onClick={onClose} type="button" aria-label="Close dialog"><X size={16} /></button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#5d5871]" htmlFor="memory-title">Title</label>
            <input className="field" id="memory-title" maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. The decision I made about my project" value={title} />
            {errors.title ? <p className="mt-1.5 text-xs font-semibold text-[#bd6c8d]">{errors.title}</p> : null}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#5d5871]" htmlFor="memory-content">Your note</label>
            <textarea className="field min-h-[150px] resize-y leading-6" id="memory-content" maxLength={8000} onChange={(event) => setContent(event.target.value)} placeholder="Write the context, decision, idea, or useful detail..." value={content} />
            <div className="mt-1.5 flex items-center justify-between">
              {errors.content ? <p className="text-xs font-semibold text-[#bd6c8d]">{errors.content}</p> : <span />}
              <span className="text-[10px] font-medium text-[#aaa5b8]">{content.length}/8000</span>
            </div>
            {!isEditing ? <div className="mt-2 flex flex-wrap items-center gap-2"><SpeechInputButton disabled={saving || uploading} label="Dictate note" onTranscript={(transcript) => { setContent((current) => appendSpeechText(current, transcript)); setVoiceUsed(true); }} /><span className="text-[10px] text-[#aaa5b8]">Speak a memory and edit it before saving.</span></div> : null}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#5d5871]" htmlFor="memory-tags">Tags <span className="font-normal text-[#aaa5b8]">(optional, comma-separated)</span></label>
            <input className="field" id="memory-tags" onChange={(event) => setTags(event.target.value)} placeholder="project, decision, study" value={tags} />
            {errors.tags ? <p className="mt-1.5 text-xs font-semibold text-[#bd6c8d]">{errors.tags}</p> : null}
          </div>
          {!isEditing ? <div className="rounded-2xl border border-dashed border-[#d5c7ff] bg-[#fbfaff] p-4"><div className="flex items-center gap-2"><FileUp className="text-[#7354c7]" size={16} /><p className="text-xs font-bold text-[#5d5871]">Import a file instead</p></div><p className="mt-1 text-[10px] leading-4 text-[#918aa3]">PDF, TXT, Markdown, DOCX, image, or audio. Mimo extracts it into searchable memories.</p><input accept=".pdf,.txt,.md,.docx,.jpg,.jpeg,.png,.webp,.webm,.wav,.mp3" className="mt-3 block w-full text-xs text-[#817b96] file:mr-3 file:rounded-lg file:border-0 file:bg-[#eee7ff] file:px-3 file:py-2 file:text-[11px] file:font-bold file:text-[#7354c7]" disabled={saving || uploading} onChange={handleFileInput} type="file" />{selectedFilename ? <p className="mt-2 text-[10px] font-semibold text-[#7354c7]">{uploading ? `Processing ${selectedFilename}...` : `${selectedFilename} processed`}</p> : null}</div> : null}
          <div className="flex flex-col-reverse gap-2 border-t border-[#f1eef7] pt-5 sm:flex-row sm:justify-end">
            <button className="quiet-button" disabled={saving} onClick={onClose} type="button">Cancel</button>
            <button className="primary-button" disabled={saving} type="submit"><Check size={16} /> {saving ? "Saving..." : isEditing ? "Save changes" : "Save memory"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
