-- Paste this into Supabase -> SQL Editor -> Run.
-- Public shared editing as explicitly requested: anyone with the site URL can add/edit/delete.
create extension if not exists pgcrypto;
create table if not exists public.quiz_decks (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(title) between 1 and 180),
 subject text not null default 'Khác',
 questions jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists quiz_decks_created_at_idx on public.quiz_decks (created_at desc);
alter table public.quiz_decks enable row level security;
drop policy if exists "Public read quiz decks" on public.quiz_decks;
drop policy if exists "Public insert quiz decks" on public.quiz_decks;
drop policy if exists "Public update quiz decks" on public.quiz_decks;
drop policy if exists "Public delete quiz decks" on public.quiz_decks;
create policy "Public read quiz decks" on public.quiz_decks for select to anon using (true);
create policy "Public insert quiz decks" on public.quiz_decks for insert to anon with check (true);
create policy "Public update quiz decks" on public.quiz_decks for update to anon using (true) with check (true);
create policy "Public delete quiz decks" on public.quiz_decks for delete to anon using (true);
grant select, insert, update, delete on public.quiz_decks to anon;
