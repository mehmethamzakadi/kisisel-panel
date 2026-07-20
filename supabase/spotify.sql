-- Spotify: dinleme arşivi + notlara şarkı damgası.
-- Tekrar çalıştırmak güvenlidir.

-- 1) OAuth kimlik bilgileri.
--    refresh_token bir sırdır; tarayıcı onu hiç görmez. RLS açık ama bilerek
--    hiçbir policy yazılmadı: authenticated rolü bu tabloya erişemez, yalnızca
--    service_role kullanan Edge Function okur/yazar.
create table if not exists public.spotify_auth (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  access_token  text,
  expires_at    timestamptz,
  connected_at  timestamptz not null default now()
);

alter table public.spotify_auth enable row level security;

-- 2) OAuth state.
--    Spotify callback'inde JWT yoktur; hangi kullanıcının yetkilendirmesi
--    olduğu ancak bu tablodan bilinir. Aynı zamanda CSRF koruması.
--    return_to: akışın hangi panelden başladığı. Canlı panel ve localhost
--    aynı Spotify uygulamasını paylaştığı için callback'in nereye döneceği
--    sabit olamaz.
create table if not exists public.spotify_oauth_state (
  state      text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  return_to  text,
  created_at timestamptz not null default now()
);

alter table public.spotify_oauth_state add column if not exists return_to text;

alter table public.spotify_oauth_state enable row level security;

-- 3) Dinleme arşivi.
--    Spotify yalnızca son 50 şarkıyı verir ve gerisini vermez. Cron her
--    çalıştığında bu pencereyi buraya boşalttığı için zamanla Spotify'ın
--    kendisinde bulunmayan bir geçmiş birikir.
--    Birincil anahtar (user_id, played_at): pencereler üst üste bindiğinde
--    aynı çalma iki kez yazılmaz, senkron böylece tekrar çalıştırılabilir olur.
create table if not exists public.plays (
  user_id     uuid not null references auth.users (id) on delete cascade,
  played_at   timestamptz not null,
  track_id    text not null,
  track       text not null,
  artist      text not null,
  album       text,
  art         text,
  url         text,
  duration_ms integer,
  primary key (user_id, played_at)
);

alter table public.plays enable row level security;

create policy "plays sahibi okur"
  on public.plays for select to authenticated using (auth.uid() = user_id);

-- 4) Notlara şarkı damgası: {track, artist, art, url}.
--    Ayrı kolonlar yerine jsonb — saved_meals'daki kalıbın aynısı.
alter table public.notes add column if not exists spotify jsonb;
