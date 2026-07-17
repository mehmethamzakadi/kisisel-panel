-- Supabase SQL Editor'de bir kez çalıştırılır.

-- 1) Dış API'lerden çekilen veriler burada önbelleklenir.
--    Edge Function service_role ile yazar, panel sadece okur.
create table if not exists public.snapshots (
  key         text primary key,
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);

-- 2) Günün sözü havuzu.
create table if not exists public.quotes (
  id      bigint generated always as identity primary key,
  body    text not null,
  author  text
);

-- 3) Veri girişi örneği: kişisel notlar.
create table if not exists public.notes (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body        text not null,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notes_pinned_idx
  on public.notes (user_id, pinned desc, created_at desc);

alter table public.snapshots enable row level security;
alter table public.quotes    enable row level security;
alter table public.notes     enable row level security;

-- Ortak veriler: giriş yapmış kullanıcı okur, kimse yazamaz.
-- (Edge Function service_role kullandığı için RLS'i atlar.)
create policy "snapshots okunabilir"
  on public.snapshots for select to authenticated using (true);

create policy "quotes okunabilir"
  on public.quotes for select to authenticated using (true);

-- Kişisel veri: yalnızca sahibi.
create policy "notes sahibi okur"
  on public.notes for select to authenticated using (auth.uid() = user_id);

create policy "notes sahibi ekler"
  on public.notes for insert to authenticated with check (auth.uid() = user_id);

create policy "notes sahibi günceller"
  on public.notes for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notes sahibi siler"
  on public.notes for delete to authenticated using (auth.uid() = user_id);

-- Başlangıç için birkaç söz.
insert into public.quotes (body, author) values
  ('Bugün yapabileceğin küçük bir şey, yarın yapamayacağın büyük bir şeyden iyidir.', null),
  ('Yolun uzunluğu değil, adımın sürekliliği önemlidir.', null),
  ('Mükemmel, iyinin düşmanıdır.', 'Voltaire'),
  ('Başlamak, bitirmenin yarısıdır.', 'Horatius'),
  ('Zorluklar, hazırlıksız yakaladıklarını yıkar.', 'Seneca')
on conflict do nothing;
