-- Run once in Supabase > SQL Editor > New query > Run.
-- One table holds all editable site content (blog posts, settings, gallery list, hero, YouTube thumbnail, admin sign-in).
-- Row Level Security is ON with no policies, so the public/anon key cannot read or write it.
-- Only the server (secret key) can, via the Vercel admin API and the build.

create table if not exists public.site_content (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

-- Storage bucket for photos (public so the website can show them). Safe to run if you already created it.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

-- Instant publishing: the website reads the public copy ("public" and "post:<slug>" rows) with the publishable key.
-- Only those rows are readable; drafts, settings history and the admin sign-in row stay private.
drop policy if exists "public copy is readable" on public.site_content;
create policy "public copy is readable" on public.site_content
  for select to anon, authenticated
  using (key = 'public' or key like 'post:%');
