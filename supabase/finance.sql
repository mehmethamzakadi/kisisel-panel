-- Altın ve döviz geçmişi. Tekrar çalıştırmak güvenlidir.
--
-- snapshots tablosu üzerine yazıyor: panel yalnızca "şu an"ı biliyor. Cron
-- zaten 15 dakikada bir dış kaynakları çekiyor; buraya da yazınca zamanla
-- kendi fiyat geçmişimiz birikiyor ve trend gösterilebiliyor.
--
-- bucket: kayıt saat başına yuvarlanır ve birincil anahtarın parçasıdır.
-- Böylece 15 dakikalık cron saatte dört kez yazmaya çalışsa da yalnızca ilki
-- girer — tablo kendi kendini sınırlar, ayrıca "son kayıt neydi" sorgusu
-- yapmaya gerek kalmaz. Kod başına günde 24 nokta, 7 günlük grafik için fazlası.
create table if not exists public.rate_history (
  kind   text not null,           -- 'rate' | 'gold'
  code   text not null,           -- USD, EUR, GRA, CEYREKALTIN…
  bucket timestamptz not null,
  value  numeric not null,        -- satış fiyatı
  primary key (kind, code, bucket)
);

create index if not exists rate_history_lookup_idx
  on public.rate_history (kind, code, bucket desc);

alter table public.rate_history enable row level security;

-- Ortak veri: giriş yapmış kullanıcı okur, yalnızca Edge Function yazar.
create policy "rate_history okunabilir"
  on public.rate_history for select to authenticated using (true);
