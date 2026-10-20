-- Run this in Supabase SQL Editor before enabling cloud memories.
-- Never add a service_role key to the app or .env.local.

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  tags text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memories_title_length check (char_length(btrim(title)) between 1 and 120),
  constraint memories_content_length check (char_length(btrim(content)) between 1 and 8000),
  constraint memories_tag_count check (cardinality(tags) <= 8)
);

alter table public.memories add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists memories_user_updated_idx on public.memories (user_id, updated_at desc);

alter table public.memories enable row level security;

drop policy if exists "Users can access their own memories" on public.memories;
create policy "Users can access their own memories"
  on public.memories for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.set_memory_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_memories_updated_at on public.memories;
create trigger set_memories_updated_at
before update on public.memories
for each row execute function public.set_memory_updated_at();
