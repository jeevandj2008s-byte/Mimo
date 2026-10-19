"use client";

import { CalendarDays, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Memory } from "@/lib/types";

type MemoryCardProps = {
  memory: Memory;
  onOpen: (memory: Memory) => void;
  onEdit: (memory: Memory) => void;
  onDelete: (memory: Memory) => void;
};

export function formatMemoryDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function MemoryCard({ memory, onOpen, onEdit, onDelete }: MemoryCardProps) {
  return (
    <article className="group surface flex min-h-[202px] flex-col p-5 transition hover:-translate-y-0.5 hover:border-[#d5c7ff] hover:shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <button className="text-left" onClick={() => onOpen(memory)} type="button">
          <h3 className="line-clamp-2 text-[15px] font-bold leading-6 text-[#342e4c] transition group-hover:text-[#5c40a8]">{memory.title}</h3>
        </button>
        <div className="relative flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <button className="rounded-lg p-1.5 text-[#aaa5b8] hover:bg-[#f5f1ff] hover:text-[#7354c7]" onClick={() => onEdit(memory)} type="button" aria-label={`Edit ${memory.title}`}>
            <Pencil size={14} />
          </button>
          <button className="rounded-lg p-1.5 text-[#aaa5b8] hover:bg-[#fff0f4] hover:text-[#bd6c8d]" onClick={() => onDelete(memory)} type="button" aria-label={`Delete ${memory.title}`}>
            <Trash2 size={14} />
          </button>
          <MoreHorizontal className="mt-1 hidden text-[#d5cfe1] sm:block" size={14} aria-hidden="true" />
        </div>
      </div>
      <button className="mt-3 line-clamp-3 text-left text-sm leading-6 text-[#817b96]" onClick={() => onOpen(memory)} type="button">
        {memory.content}
      </button>
      <div className="mt-auto flex items-end justify-between gap-3 pt-5">
        <div className="flex flex-wrap gap-1.5">
          {memory.tags.slice(0, 3).map((tag) => (
            <span className="rounded-full bg-[#f7f4ff] px-2.5 py-1 text-[10px] font-bold text-[#8067c0]" key={`${memory.id}-${tag}`}>#{tag}</span>
          ))}
          {memory.tags.length > 3 ? <span className="rounded-full bg-[#faf9fc] px-2 py-1 text-[10px] font-semibold text-[#aaa5b8]">+{memory.tags.length - 3}</span> : null}
        </div>
        <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-[#aaa5b8]" title={new Date(memory.updatedAt).toLocaleString()}>
          <CalendarDays size={12} />
          {formatMemoryDate(memory.updatedAt)}
        </span>
      </div>
    </article>
  );
}
