"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import type { Memory, MemoryInput } from "@/lib/types";
import { validateMemoryInput, type MemoryValidationErrors } from "@/lib/validation";

type CaptureMemoryDialogProps = {
  open: boolean;
  memory?: Memory | null;
  onClose: () => void;
  onSave: (input: MemoryInput) => void;
};

export function CaptureMemoryDialog({ open, memory, onClose, onSave }: CaptureMemoryDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [errors, setErrors] = useState<MemoryValidationErrors>({});

  useEffect(() => {
    if (!open) return;
    setTitle(memory?.title ?? "");
    setContent(memory?.content ?? "");
    setTags(memory?.tags.join(", ") ?? "");
    setErrors({});
  }, [open, memory]);

  if (!open) return null;

  const isEditing = Boolean(memory);
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = validateMemoryInput({ title, content, tags: tags.split(",") });
    setErrors(result.errors);
    if (!result.valid || !result.value) return;
    onSave(result.value);
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
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#5d5871]" htmlFor="memory-tags">Tags <span className="font-normal text-[#aaa5b8]">(optional, comma-separated)</span></label>
            <input className="field" id="memory-tags" onChange={(event) => setTags(event.target.value)} placeholder="project, decision, study" value={tags} />
            {errors.tags ? <p className="mt-1.5 text-xs font-semibold text-[#bd6c8d]">{errors.tags}</p> : null}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-[#f1eef7] pt-5 sm:flex-row sm:justify-end">
            <button className="quiet-button" onClick={onClose} type="button">Cancel</button>
            <button className="primary-button" type="submit"><Check size={16} /> {isEditing ? "Save changes" : "Save memory"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
