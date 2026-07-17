-- Alışveriş listesi, kayıtlı tarifler, kart tercihleri ve not hatırlatmaları.
-- Tekrar çalıştırmak güvenlidir.

-- Notlara hatırlatma tarihi
alter table public.notes add column if not exists remind_on date;

create index if not exists notes_remind_idx
  on public.notes (user_id, remind_on)
  where remind_on is not null;

-- Alışveriş listesi
create table if not exists public.shopping_items (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body        text not null,
  checked     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists shopping_user_idx
  on public.shopping_items (user_id, checked, created_at desc);

-- Beğenilen / kaydedilen tarifler
create table if not exists public.saved_meals (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null,
  summary      text,
  minutes      integer,
  ingredients  jsonb not null default '[]'::jsonb,
  steps        jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

create unique index if not exists saved_meals_unique
  on public.saved_meals (user_id, name);

-- Kart sırası ve görünürlüğü (kullanıcı başına tek satır)
create table if not exists public.prefs (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  cards       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.shopping_items enable row level security;
alter table public.saved_meals    enable row level security;
alter table public.prefs          enable row level security;

-- Hepsi kişisel veri: yalnızca sahibi görür ve değiştirir.
create policy "shopping sahibi okur"      on public.shopping_items for select to authenticated using (auth.uid() = user_id);
create policy "shopping sahibi ekler"     on public.shopping_items for insert to authenticated with check (auth.uid() = user_id);
create policy "shopping sahibi günceller" on public.shopping_items for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "shopping sahibi siler"     on public.shopping_items for delete to authenticated using (auth.uid() = user_id);

create policy "tarif sahibi okur"      on public.saved_meals for select to authenticated using (auth.uid() = user_id);
create policy "tarif sahibi ekler"     on public.saved_meals for insert to authenticated with check (auth.uid() = user_id);
create policy "tarif sahibi siler"     on public.saved_meals for delete to authenticated using (auth.uid() = user_id);

create policy "prefs sahibi okur"      on public.prefs for select to authenticated using (auth.uid() = user_id);
create policy "prefs sahibi ekler"     on public.prefs for insert to authenticated with check (auth.uid() = user_id);
create policy "prefs sahibi günceller" on public.prefs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
