"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronRight, Clock3, Search, Sparkles } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { useAuth } from "@/components/auth-provider";
import { AnswerPanel } from "@/components/answer-panel";
import { AppSidebar, type AppView, MimoMark } from "@/components/app-sidebar";
import { AskPanel } from "@/components/ask-panel";
import { CaptureMemoryDialog } from "@/components/capture-memory-dialog";
import { EmptyState } from "@/components/empty-state";
import { MemoryCard } from "@/components/memory-card";
import { SourceViewer } from "@/components/source-viewer";
import { cloneDemoMemories } from "@/lib/demo-data";
import { addDemoMemories, createMemory, loadMemories, persistMemories, updateMemory } from "@/lib/memory-store";
import { createCloudMemory, deleteCloudMemory, insertCloudMemories, loadCloudMemories, updateCloudMemory } from "@/lib/memory-repository";
import { searchMemories } from "@/lib/search-memories";
import { isMemory } from "@/lib/validation";
import type { Memory, MemoryInput, RecallAnswer } from "@/lib/types";

const DEMO_QUESTION = "What did I decide to build first for my AI project, and why?";

export default function HomePage() {
  const auth = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [memoryLoading, setMemoryLoading] = useState(true);
  const [view, setView] = useState<AppView>("workspace");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<RecallAnswer | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [viewingMemory, setViewingMemory] = useState<Memory | null>(null);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (auth.loading) return;
    let active = true;
    setMemoryLoading(true);
    setMemories([]);
    void (async () => {
      try {
        const nextMemories = auth.configured && auth.user ? await loadCloudMemories() : loadMemories();
        if (active) setMemories(nextMemories);
      } catch {
        if (active) setNotice("Mimo could not load this account’s memories. Check that the Supabase memories table is set up.");
      } finally {
        if (active) {
          setHydrated(true);
          setMemoryLoading(false);
        }
      }
    })();
    return () => { active = false; };
  }, [auth.configured, auth.loading, auth.user]);

  useEffect(() => {
    if (hydrated && !auth.user) persistMemories(memories);
  }, [auth.user, hydrated, memories]);

  const recentMemories = memories.slice(0, 3);
  const filteredMemories = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    if (!query) return memories;
    return memories.filter((memory) => `${memory.title} ${memory.content} ${memory.tags.join(" ")}`.toLowerCase().includes(query));
  }, [libraryQuery, memories]);

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => current === message ? null : current), 3500);
  };

  const openCapture = (memory: Memory | null = null) => {
    setEditingMemory(memory);
    setCaptureOpen(true);
  };

  const handleSaveMemory = async (input: MemoryInput) => {
    try {
      if (auth.configured && auth.user) {
        const saved = editingMemory ? await updateCloudMemory(editingMemory.id, input) : await createCloudMemory(input);
        setMemories((current) => editingMemory ? current.map((memory) => memory.id === editingMemory.id ? saved : memory) : [saved, ...current]);
      } else if (editingMemory) {
        setMemories((current) => current.map((memory) => memory.id === editingMemory.id ? updateMemory(memory, input) : memory));
      } else {
        setMemories((current) => [createMemory(input), ...current]);
      }
      showNotice(editingMemory ? "Memory updated — Mimo will remember the new version." : "Memory saved — nice, that’s one less thing to hold in your head.");
      setCaptureOpen(false);
      setEditingMemory(null);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Mimo could not save that memory.");
    }
  };

  const handleDelete = async (memory: Memory) => {
    if (!window.confirm(`Delete “${memory.title}”? This cannot be undone.`)) return;
    try {
      if (auth.configured && auth.user) await deleteCloudMemory(memory.id);
      setMemories((current) => current.filter((candidate) => candidate.id !== memory.id));
      if (viewingMemory?.id === memory.id) setViewingMemory(null);
      showNotice("Memory deleted.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Mimo could not delete that memory.");
    }
  };

  const loadDemo = async (reset = false) => {
    const demo = cloneDemoMemories();
    try {
      if (auth.configured && auth.user) {
        const current = reset ? [] : memories;
        const missing = demo.filter((candidate) => !current.some((memory) => memory.title === candidate.title));
        const inserted = await insertCloudMemories(missing.map(({ title, content, tags }) => ({ title, content, tags })));
        setMemories(reset ? inserted : [...inserted, ...current]);
      } else {
        setMemories((current) => reset ? demo : addDemoMemories(current, demo));
      }
      showNotice(reset ? "Demo memories restored." : "Sample memories added — try asking Mimo about the AI project.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Mimo could not load sample memories.");
    }
  };

  const handleUpload = async (file: File) => {
    if (!auth.configured || !auth.user) {
      showNotice("Sign in to upload files. Guest text memories still work in this browser.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const error = payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).error === "string" ? (payload as Record<string, string>).error : "Mimo could not process this file.";
        showNotice(error);
        return;
      }
      const uploaded: unknown[] = payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).memories) ? (payload as Record<string, unknown>).memories as unknown[] : [];
      if (!uploaded.length || !uploaded.every(isMemory)) {
        showNotice("Mimo received an invalid upload response and did not add it.");
        return;
      }
      setMemories((current) => [...(uploaded as Memory[]), ...current]);
      const firstUploaded = uploaded[0] as Memory;
      showNotice(`${file.name} is now searchable. The extracted text is open in Mimo's text pad.`);
      setView("workspace");
      setEditingMemory(firstUploaded);
      setCaptureOpen(true);
    } catch {
      showNotice("Mimo could not upload this file. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  const askMimo = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || answerLoading) return;
    setAnswer(null);
    setAnswerError(null);
    setAnswerLoading(true);

    const relevantMemories = searchMemories(trimmedQuestion, memories);
    if (relevantMemories.length === 0) {
      setAnswer({ answer: "I couldn't find that in your memories yet. Want to save it?", citations: [], insufficientEvidence: true });
      setAnswerLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmedQuestion, memories: relevantMemories }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message = payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).error === "string"
          ? (payload as Record<string, string>).error
          : "Mimo could not answer right now.";
        if ((payload as Record<string, unknown>)?.code === "MISSING_API_KEY") {
          setAnswerError("Live answers are not configured yet. Add OPENAI_API_KEY to .env.local, restart the server, and ask again.");
        } else {
          setAnswerError(message);
        }
        return;
      }
      setAnswer(payload as RecallAnswer);
    } catch {
      setAnswerError("Mimo could not connect to the answer service. Check your connection and try again.");
    } finally {
      setAnswerLoading(false);
    }
  };

  const tryDemoQuestion = () => {
    setQuestion(DEMO_QUESTION);
    setView("workspace");
  };

  return (
    <div className="min-h-screen md:flex">
      <AppSidebar activeView={view} memoryCount={memories.length} onCapture={() => openCapture()} onLoadDemo={() => loadDemo(false)} onNavigate={setView} onResetDemo={() => loadDemo(true)} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1240px] px-5 py-7 sm:px-8 sm:py-9 lg:px-12">
          {notice ? <div className="fixed right-5 top-5 z-50 max-w-sm rounded-xl bg-[#302845] px-4 py-3 text-xs font-semibold text-white shadow-2xl" role="status">{notice}</div> : null}
          <div className="mb-5 flex justify-end"><AccountMenu onNotice={showNotice} /></div>
          {view === "workspace" ? (
            <WorkspaceView answer={answer} answerError={answerError} answerLoading={answerLoading} memories={memories} memoryLoading={memoryLoading} onAsk={askMimo} onDelete={handleDelete} onEdit={openCapture} onLoadDemo={() => loadDemo(false)} onOpenMemory={setViewingMemory} onSaveFromQuestion={() => openCapture()} onUpload={handleUpload} question={question} recentMemories={recentMemories} setQuestion={setQuestion} onNavigate={setView} uploading={uploading} />
          ) : (
            <LibraryView memories={filteredMemories} memoryLoading={memoryLoading} query={libraryQuery} onDelete={handleDelete} onEdit={openCapture} onOpenMemory={setViewingMemory} onQueryChange={setLibraryQuery} onCapture={() => openCapture()} onTryDemo={tryDemoQuestion} />
          )}
        </div>
      </main>
      <CaptureMemoryDialog memory={editingMemory} onClose={() => { setCaptureOpen(false); setEditingMemory(null); }} onSave={handleSaveMemory} onUpload={handleUpload} open={captureOpen} uploading={uploading} />
      <SourceViewer memory={viewingMemory} onClose={() => setViewingMemory(null)} onEdit={(memory) => { setViewingMemory(null); openCapture(memory); }} />
    </div>
  );
}

type WorkspaceViewProps = {
  memories: Memory[];
  recentMemories: Memory[];
  memoryLoading: boolean;
  question: string;
  setQuestion: (value: string) => void;
  onAsk: () => void;
  onOpenMemory: (memory: Memory) => void;
  onDelete: (memory: Memory) => void;
  onEdit: (memory: Memory) => void;
  onLoadDemo: () => void;
  onUpload: (file: File) => Promise<void>;
  onSaveFromQuestion: () => void;
  onNavigate: (view: AppView) => void;
  answer: RecallAnswer | null;
  answerLoading: boolean;
  answerError: string | null;
  uploading: boolean;
};

function WorkspaceView({ memories, recentMemories, memoryLoading, question, setQuestion, onAsk, onOpenMemory, onDelete, onEdit, onLoadDemo, onSaveFromQuestion, onUpload, onNavigate, answer, answerLoading, answerError, uploading }: WorkspaceViewProps) {
  return (
    <>
      <header className="mb-8 flex items-start justify-between gap-6">
        <div className="flex items-start gap-3">
          <div className="md:hidden"><MimoMark compact /></div>
          <div><p className="eyebrow">Monday, {new Intl.DateTimeFormat("en", { month: "long", day: "numeric" }).format(new Date())}</p><h1 className="mt-1.5 text-3xl font-extrabold tracking-[-0.06em] text-[#302845] sm:text-4xl">Hiii! What should we remember today? <span aria-hidden="true">💜</span></h1><p className="mt-2 text-sm leading-6 text-[#817b96]">Your little mind, with a memory of its own.</p></div>
        </div>
        <div className="hidden rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#817b96] shadow-sm ring-1 ring-[#eeeaf5] sm:block"><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#78c9a5]" /> {memories.length} {memories.length === 1 ? "memory" : "memories"}</div>
      </header>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0 space-y-7">
          <AskPanel loading={answerLoading} onAsk={onAsk} onQuestionChange={setQuestion} onUpload={onUpload} question={question} uploading={uploading} />
          <AnswerPanel answer={answer} error={answerError} loading={answerLoading} memories={memories} onOpenMemory={onOpenMemory} onSaveFromQuestion={onSaveFromQuestion} />
          <section>
            <div className="mb-3 flex items-center justify-between"><div><p className="eyebrow">Your latest notes</p><h2 className="mt-1 text-lg font-extrabold tracking-[-0.03em] text-[#342e4c]">Recent memories</h2></div><button className="quiet-button" onClick={() => onNavigate("library")} type="button">View library <ChevronRight size={15} /></button></div>
            {memoryLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-3"><div className="h-[202px] animate-pulse rounded-3xl bg-white ring-1 ring-[#eeeaf5]" /><div className="hidden h-[202px] animate-pulse rounded-3xl bg-white ring-1 ring-[#eeeaf5] md:block" /></div> : recentMemories.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-3">{recentMemories.map((memory) => <MemoryCard key={memory.id} memory={memory} onDelete={onDelete} onEdit={onEdit} onOpen={onOpenMemory} />)}</div> : <EmptyState actionLabel="Load sample data" description="Save your first note or load a few sample memories to see how Mimo connects the dots." onAction={onLoadDemo} title="Your memory shelf is ready" />}
          </section>
        </div>
        <aside className="hidden xl:block">
          <div className="surface overflow-hidden bg-[#302845] p-6 text-white">
            <div className="flex items-center justify-between"><span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d5c7ff]">How Mimo works</span><span className="text-2xl" aria-hidden="true">🐘</span></div>
            <h2 className="mt-6 text-xl font-extrabold leading-7 tracking-[-0.03em]">From a tiny note to a clear answer.</h2>
            <div className="mt-6 space-y-5">
              {["Save the moments, decisions, and ideas you want back.", "Ask in your own words — no special search syntax.", "Open the exact source behind every supported answer."] .map((step, index) => <div className="flex gap-3" key={step}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7354c7] text-[10px] font-extrabold">{index + 1}</span><p className="text-xs leading-5 text-[#d9d3e7]">{step}</p></div>)}
            </div>
            <div className="mt-7 rounded-2xl bg-white/10 p-3.5 text-xs leading-5 text-[#e8e0ff]"><span className="font-bold text-white">Mimo’s promise:</span> if a note doesn’t support an answer, it will say so.</div>
          </div>
        </aside>
      </div>
    </>
  );
}

type LibraryViewProps = {
  memories: Memory[];
  memoryLoading: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  onOpenMemory: (memory: Memory) => void;
  onEdit: (memory: Memory) => void;
  onDelete: (memory: Memory) => void;
  onCapture: () => void;
  onTryDemo: () => void;
};

function LibraryView({ memories, memoryLoading, query, onQueryChange, onOpenMemory, onEdit, onDelete, onCapture, onTryDemo }: LibraryViewProps) {
  return (
    <>
      <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="eyebrow">Your personal archive</p><h1 className="mt-1.5 text-3xl font-extrabold tracking-[-0.06em] text-[#302845]">Memory library</h1><p className="mt-2 text-sm leading-6 text-[#817b96]">Everything you have asked Mimo to hold onto, in one calm place.</p></div><button className="primary-button self-start sm:self-auto" onClick={onCapture} type="button"><Sparkles size={16} /> Save a memory</button></header>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row"><label className="relative block flex-1"><Search className="absolute left-3.5 top-3.5 text-[#aaa5b8]" size={17} /><input className="field pl-10" onChange={(event) => onQueryChange(event.target.value)} placeholder="Search titles, notes, or tags..." value={query} /></label><div className="flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-xs font-semibold text-[#817b96] ring-1 ring-[#eeeaf5]"><Clock3 size={15} className="text-[#9273e6]" /> Chronological</div></div>
      {memoryLoading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><div className="h-[202px] animate-pulse rounded-3xl bg-white ring-1 ring-[#eeeaf5]" /><div className="hidden h-[202px] animate-pulse rounded-3xl bg-white ring-1 ring-[#eeeaf5] md:block" /><div className="hidden h-[202px] animate-pulse rounded-3xl bg-white ring-1 ring-[#eeeaf5] xl:block" /></div> : memories.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{memories.map((memory) => <MemoryCard key={memory.id} memory={memory} onDelete={onDelete} onEdit={onEdit} onOpen={onOpenMemory} />)}</div> : <EmptyState actionLabel={query ? "Try the demo question" : "Save your first memory"} description={query ? "No notes match that search yet. Try another phrase or load the sample memories." : "This is where your ideas, decisions, and useful details will live."} onAction={query ? onTryDemo : onCapture} title={query ? "No memories found" : "Your library is still quiet"} />}
      <div className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-[#aaa5b8]"><BookOpen size={13} /> Your memories are stored locally in this browser.</div>
    </>
  );
}
