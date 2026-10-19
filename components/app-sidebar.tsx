"use client";

import { BookOpen, Home, Plus, RotateCcw, Sparkles } from "lucide-react";

export type AppView = "workspace" | "library";

type AppSidebarProps = {
  activeView: AppView;
  memoryCount: number;
  onNavigate: (view: AppView) => void;
  onCapture: () => void;
  onLoadDemo: () => void;
  onResetDemo: () => void;
};

function MimoMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative flex shrink-0 items-center justify-center rounded-2xl bg-[#eee7ff] ${compact ? "h-10 w-10" : "h-11 w-11"}`} aria-hidden="true">
      <svg className="h-8 w-8" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.5 27.5c-2.3-1.7-3.7-4.4-3.7-7.7 0-6.3 5.3-11.3 12-11.3h6.5c7.1 0 12.9 5.5 12.9 12.3v8.9c0 2.7-2.2 4.8-4.8 4.8h-1.7v3.2c0 1.2-1 2.2-2.2 2.2h-1.1c-1.2 0-2.2-1-2.2-2.2v-3.2H19.8v3.2c0 1.2-1 2.2-2.2 2.2h-1.1c-1.2 0-2.2-1-2.2-2.2v-4.2c-1.1-.8-1.8-2.1-1.8-3.6v-2.4Z" fill="#B8A2F5" />
        <path d="M11.4 19.8c-4.1-1.7-6.5.6-6.5 3.3 0 3.1 3 5.1 6.2 4.1l2.3-.7v-5.7l-2-.9Z" fill="#9273E6" />
        <path d="M37.2 21.4c2.2 0 4 1.8 4 4s-1.8 4-4 4h-2v-8h2Z" fill="#9273E6" />
        <circle cx="24.1" cy="20" fill="#302845" r="1.6" />
        <path d="M30.3 27.4c-1.8 1.7-4.9 1.7-6.7 0" stroke="#7354C7" strokeLinecap="round" strokeWidth="1.8" />
        <path d="m39.3 7.1 1.3 2.9 3.1.3-2.3 2.1.7 3.1-2.8-1.6-2.8 1.6.7-3.1-2.3-2.1 3.1-.3 1.3-2.9Z" fill="#E6A2BD" />
      </svg>
    </div>
  );
}

export { MimoMark };

export function AppSidebar({ activeView, memoryCount, onNavigate, onCapture, onLoadDemo, onResetDemo }: AppSidebarProps) {
  return (
    <aside className="flex w-full flex-col border-b border-[#eeeaf5] bg-white px-5 py-4 md:min-h-screen md:w-[246px] md:border-b-0 md:border-r md:px-4 md:py-6">
      <div className="flex items-center justify-between md:block">
        <div className="flex items-center gap-3 px-1">
          <MimoMark />
          <div>
            <p className="text-[17px] font-extrabold tracking-[-0.03em] text-[#322a4b]">Mimo</p>
            <p className="text-[11px] font-medium text-[#9b95ab]">your memory buddy</p>
          </div>
        </div>
        <button className="quiet-button md:hidden" onClick={onCapture} type="button" aria-label="Save a memory">
          <Plus size={17} />
          <span className="hidden sm:inline">Save memory</span>
        </button>
      </div>

      <button className="primary-button mt-8 hidden w-full md:flex" onClick={onCapture} type="button">
        <Plus size={17} />
        Save a memory
      </button>

      <nav className="mt-5 flex gap-1 overflow-x-auto md:mt-8 md:block" aria-label="Primary navigation">
        <button
          className={`flex min-w-max items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition md:w-full ${activeView === "workspace" ? "bg-[#f5f1ff] text-[#5c40a8]" : "text-[#817b96] hover:bg-[#fbfaff] hover:text-[#5c40a8]"}`}
          onClick={() => onNavigate("workspace")}
          type="button"
        >
          <Home size={17} strokeWidth={activeView === "workspace" ? 2.2 : 1.8} />
          Workspace
        </button>
        <button
          className={`flex min-w-max items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition md:mt-1 md:w-full ${activeView === "workspace" ? "text-[#817b96] hover:bg-[#fbfaff] hover:text-[#5c40a8]" : "bg-[#f5f1ff] text-[#5c40a8]"}`}
          onClick={() => onNavigate("workspace")}
          type="button"
        >
          <Sparkles size={17} strokeWidth={activeView === "workspace" ? 2.2 : 1.8} />
          Ask Mimo
        </button>
        <button
          className={`flex min-w-max items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition md:mt-1 md:w-full ${activeView === "library" ? "bg-[#f5f1ff] text-[#5c40a8]" : "text-[#817b96] hover:bg-[#fbfaff] hover:text-[#5c40a8]"}`}
          onClick={() => onNavigate("library")}
          type="button"
        >
          <BookOpen size={17} strokeWidth={activeView === "library" ? 2.2 : 1.8} />
          Memory library
          <span className="ml-auto rounded-full bg-[#f5f1ff] px-2 py-0.5 text-[11px] font-bold text-[#7354c7]">{memoryCount}</span>
        </button>
      </nav>

      <div className="mt-6 hidden border-t border-[#f1eef7] pt-5 md:block">
        <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#aaa5b8]">Demo tools</p>
        <button className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-[#817b96] transition hover:bg-[#fff8fa] hover:text-[#bd6c8d]" onClick={onLoadDemo} type="button">
          <Sparkles size={15} />
          Load sample memories
        </button>
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-[#817b96] transition hover:bg-[#fff8fa] hover:text-[#bd6c8d]" onClick={onResetDemo} type="button">
          <RotateCcw size={15} />
          Reset to demo data
        </button>
      </div>

      <div className="mt-auto hidden rounded-2xl bg-[#fff8fa] p-4 md:block">
        <div className="flex items-start gap-2.5">
          <span className="mimo-float text-2xl" aria-hidden="true">🐘</span>
          <div>
            <p className="text-xs font-bold text-[#69475a]">Tiny reminder</p>
            <p className="mt-1 text-[11px] leading-5 text-[#a27b8b]">Guest notes stay local. Signed-in notes are isolated to your account and only selected notes are used when you ask.</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
