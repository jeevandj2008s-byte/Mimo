# Mimo — Your little mind, with a memory of its own

Mimo helps you remember what matters without losing valuable thoughts in scattered notes. It is a functional, evidence-backed personal memory assistant: save ideas, decisions, study notes, and useful details in the browser, then ask natural-language questions and open the exact saved notes behind supported answers.

## What is included

- Responsive Mimo workspace with a warm lavender/off-white visual system.
- Guest mode with a visible guest ID and local browser persistence when Supabase is not configured.
- Google OAuth and email/password account login through Supabase Auth.
- Per-account memory storage protected by Postgres Row Level Security.
- Save, edit, delete, search, inspect, and tag memories.
- Keyword retrieval with title/tag weighting, a relevance threshold, and a five-memory limit.
- Server-only `/api/ask` route using one configurable OpenAI-compatible provider and server-side account retrieval when Supabase is configured.
- Structured model output with memory ID and exact quote validation before citations display.
- Honest insufficient-evidence state for unsupported questions.
- Nine fictional student sample memories, loadable without overwriting existing notes.
- Unit tests for retrieval ranking, bounded results, unsupported questions, and input validation.

## Requirements

- Node.js 22 (the pinned project version is in `.nvmrc`).
- npm 10 or newer.
- An OpenAI API key only if live generated answers are needed.
- A Supabase project for Google/email login and synced account memories.

## Setup

```bash
cd recall-ai
npm ci
cp .env.example .env.local
```

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead of `cp`. Keep `OPENAI_API_KEY` empty while exploring the local save/search workflow, or replace the placeholder with a server-side key. Never use a `NEXT_PUBLIC_` prefix.

## Secure account setup

Mimo uses Supabase Auth and a Supabase Postgres table. The browser only receives the public Supabase URL and publishable/anon key; it never receives a service-role key. Per-user isolation is enforced by database Row Level Security, not by a client-supplied user ID.

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql).
3. In **Project Settings → API**, copy the Project URL and publishable/anon key into `.env.local`:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-anon-key
   ```

4. In **Authentication → Providers**, enable Email and Google.
5. In Google Cloud Console, create an OAuth web client and use this Supabase callback URL as the Google redirect URI:

   ```text
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```

   Replace `YOUR_PROJECT_REF` with the subdomain from `NEXT_PUBLIC_SUPABASE_URL`. Paste the Google Client ID and Client Secret into Supabase’s Google provider settings.
6. In Supabase **Authentication → URL Configuration**, add `http://localhost:3000` and `http://localhost:3000/auth/callback`.
7. Enable **Anonymous Sign-Ins** if you want guest sessions to sync to Supabase. If it is disabled, Mimo still offers a local guest mode.
8. Restart the dev server after changing `.env.local`.

When a guest signs up with email, Mimo upgrades that guest session so the same memories remain with the new account. Signing into an existing account switches to that account without silently merging unrelated guest data.

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
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase project URL; safe with RLS enabled |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase publishable/anon key; safe with RLS enabled |

When Supabase is configured, the API authenticates the current user, retrieves only that user’s memories under RLS, performs retrieval server-side, and sends only the five relevant records to the model. Without Supabase, the local guest fallback sends only the five client-retrieved, size-limited records. In both modes, the route uses a strict JSON schema and checks every quote with `source.content.includes(quote)` before returning it.

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
app/auth/callback/route.ts    OAuth/email confirmation callback
components/                   shell, forms, cards, answer and source UI
components/auth-provider.tsx  Supabase session and guest state
components/account-menu.tsx  top-right guest/account menu and auth dialog
lib/types.ts                  shared data contracts
lib/memory-store.ts           localStorage-safe persistence helpers
lib/memory-repository.ts      Supabase CRUD for the current RLS user
lib/search-memories.ts        modular keyword retrieval and scoring
lib/validation.ts             input, storage, and citation shape checks
lib/demo-data.ts              additive fictional demo dataset
supabase/schema.sql           memories table, trigger and RLS policy
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
8. Close by explaining that guest notes are local when Supabase is not configured, while signed-in notes are isolated to the account and only selected notes are sent to the server for a live answer.

## Known limitations

- Retrieval is intentionally keyword-based, not semantic search; embeddings can be added behind `searchMemories` later.
- Local browser persistence is used as a fallback when Supabase is not configured; configured accounts sync through Supabase.
- Live answers require a configured OpenAI-compatible key; the app never simulates provider output.
- Because the browser owns the local dataset, the stateless API validates the submitted memory shape, size, and quote/ID relationships but cannot independently query localStorage on the server.
