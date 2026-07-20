-- refresh-snapshot ve spotify-sync fonksiyonlarını periyodik çağırır.
-- Authorization başlığında yalnızca publishable (anon) anahtar var; bu anahtar
-- zaten tarayıcıya açık. Fonksiyon service_role anahtarını kendi ortamından
-- okur, dolayısıyla gizli anahtar veritabanına yazılmaz.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('refresh-snapshot')
where exists (select 1 from cron.job where jobname = 'refresh-snapshot');

select cron.schedule(
  'refresh-snapshot',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://hvcphkcshdjpobihzypj.supabase.co/functions/v1/refresh-snapshot',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_KpII1C6Jlqv2vZGNtQpo8w_pDRfFT85'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Spotify son çalınanları arşive boşaltır. Spotify yalnızca son 50 şarkıyı
-- tuttuğu için bu iş kaçırılırsa o aralık kalıcı olarak kaybolur; 15 dakika
-- 50 şarkının çok altında kalarak buna karşı geniş bir pay bırakır.
select cron.unschedule('spotify-sync')
where exists (select 1 from cron.job where jobname = 'spotify-sync');

select cron.schedule(
  'spotify-sync',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://hvcphkcshdjpobihzypj.supabase.co/functions/v1/spotify-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_KpII1C6Jlqv2vZGNtQpo8w_pDRfFT85'
    ),
    body := '{}'::jsonb
  );
  $$
);
