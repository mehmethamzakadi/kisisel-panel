-- Odak seansları. Tekrar çalıştırmak güvenlidir.
--
-- Seans bittiğinde (doğal olarak ya da elle durdurulduğunda) tek satır yazılır.
-- Vazgeçilen seans kaydedilmez: yanlışlıkla başlatılan sayaç istatistiği
-- bozmamalı.
create table if not exists public.focus_sessions (
  id              bigint generated always as identity primary key,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  started_at      timestamptz not null,
  ended_at        timestamptz not null default now(),
  -- Gerçekleşen ve hedeflenen ayrı tutuluyor: 50 dakikalık seansın 20.
  -- dakikasında durdurulması "20 dakika odaklandım" demektir, 50 değil.
  minutes         integer not null,
  planned_minutes integer not null,
  completed       boolean not null default false
);

create index if not exists focus_user_idx
  on public.focus_sessions (user_id, ended_at desc);

alter table public.focus_sessions enable row level security;

create policy "odak sahibi okur"
  on public.focus_sessions for select to authenticated using (auth.uid() = user_id);

create policy "odak sahibi ekler"
  on public.focus_sessions for insert to authenticated with check (auth.uid() = user_id);

create policy "odak sahibi siler"
  on public.focus_sessions for delete to authenticated using (auth.uid() = user_id);
