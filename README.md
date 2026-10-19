# Mimo — Your little mind, with a memory of its own

Mimo helps you remember what matters without losing valuable thoughts in scattered notes. It is a functional, evidence-backed personal memory assistant: save ideas, decisions, study notes, and useful details in the browser, then ask natural-language questions and open the exact saved notes behind supported answers.

## What is included

- Responsive Mimo workspace with a warm lavender/off-white visual system.
- Local browser persistence with malformed localStorage data handled safely.
- Save, edit, delete, search, inspect, and tag memories.
- Keyword retrieval with title/tag weighting, a relevance threshold, and a five-memory limit.
- Server-only `/api/ask` route using one configurable OpenAI-compatible provider.
- Structured model output with memory ID and exact quote validation before citations display.
- Honest insufficient-evidence state for unsupported questions.
- Nine fictional student sample memories, loadable without overwriting existing notes.
- Unit tests for retrieval ranking, bounded results, unsupported questions, and input validation.

## Requirements

- Node.js 22 (the pinned project version is in `.nvmrc`).
- npm 10 or newer.
- An OpenAI API key only if live generated answers are needed.

## Setup

```bash
cd recall-ai
npm ci
cp .env.example .env.local
```

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead of `cp`. Keep `OPENAI_API_KEY` empty while exploring the local save/search workflow, or replace the placeholder with a server-side key. Never use a `NEXT_PUBLIC_` prefix.

## Run locally

```bash
npm run dev
```

Open <http://localhost:3000> (or <http://127.0.0.1:3000> if your browser resolves `localhost` unexpectedly). Use **Load sample memories** in the sidebar (or the empty-state button) and try:

> What did I decide to build first for my AI project, and why?

With no provider key, Mimo will not fabricate an answer. A related question displays a clear configuration message; an unrelated question is handled locally with “I couldn't find that in your memories yet. Want to save it?”.

If you prefer the production server locally, `npm start` now checks for a production build and creates one automatically when needed before serving on <http://localhost:3000>.

## Checks

```bash
npm test
npm run typecheck
npm run build
```

The build is the project’s production check. `make test` is also available for the buildathon’s single offline test command.

## Environment variables

| Variable | Server-only purpose |
| --- | --- |
| `OPENAI_API_KEY` | Provider credential; never exposed to the browser |
| `OPENAI_MODEL` | Optional model name, defaults to `gpt-4o-mini` |

The API sends only the five client-retrieved, size-limited memory records needed for the current question. The route uses a strict JSON schema, validates IDs against supplied records, and checks every quote with `source.content.includes(quote)` before returning it.

## Production / Docker

```bash
docker build -t mimo-memory-buddy .
docker run --rm -p 3000:3000 --env-file .env.local mimo-memory-buddy
```

For a standard Node deployment:

```bash
npm ci
npm run build
npm run start
```

Set the same server-only environment variables in the deployment platform. The application itself is statically renderable, while `/api/ask` runs on the Node server.

## Architecture

```text
app/page.tsx                  client workspace and orchestration
app/api/ask/route.ts          server-only grounded provider route
components/                   shell, forms, cards, answer and source UI
lib/types.ts                  shared data contracts
lib/memory-store.ts           localStorage-safe persistence helpers
lib/search-memories.ts        modular keyword retrieval and scoring
lib/validation.ts             input, storage, and citation shape checks
lib/demo-data.ts              additive fictional demo dataset
tests/                        offline retrieval and validation tests
```

## 90-second demo script

1. Open Mimo and say: “Hiii! What should we remember today?”
2. Click **Load sample memories**; point out that the library count grows without replacing any existing notes.
3. Ask: “What did I decide to build first for my AI project, and why?”
4. With `OPENAI_API_KEY` configured, show the concise answer and the **Evidence from your memories** panel.
5. Click a citation and show the original full note; explain that the quote is only marked verified when it exactly matches the saved content.
6. Save a new memory, refresh the browser, search for it, edit it, then delete it.
7. Ask an unrelated question such as “What is my passport number?” and show Mimo honestly saying it cannot find that memory.
8. Close by explaining that all local notes remain in this browser and only selected notes are sent to the server for a live answer.

## Known limitations

- Retrieval is intentionally keyword-based, not semantic search; embeddings can be added behind `searchMemories` later.
- Browser localStorage is single-browser persistence, not multi-device sync.
- Live answers require a configured OpenAI-compatible key; the app never simulates provider output.
- Because the browser owns the local dataset, the stateless API validates the submitted memory shape, size, and quote/ID relationships but cannot independently query localStorage on the server.
