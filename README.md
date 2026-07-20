# Panelim

Kişisel günlük panel: hava durumu, döviz/altın, haberler, günün sözü ve kişisel notlar.
Tek kullanıcılık, ücretsiz servislerle çalışır.

## Yapı

- **Frontend** — Vite + React + TypeScript + Tailwind v4
- **Veri/Giriş** — Supabase (Postgres + Auth + Edge Functions)
- **Yayın** — Cloudflare Pages veya Vercel (ücretsiz)

Temel kalıp: dış API'leri **Edge Function** çağırır, sonucu `snapshots` tablosuna
yazar, panel yalnızca o tabloyu okur. Böylece API anahtarları tarayıcıya sızmaz,
CORS sorunu çıkmaz ve ücretsiz kotalar dolmaz.

Yeni kart eklemek = `snapshots`'a yeni bir `key` + yeni bir kart bileşeni.

## Kurulum

```bash
npm install
cp .env.example .env   # Supabase bilgilerini gir
npm run dev
```

`.env` boş bırakılırsa panel "giriş kapalı" modunda açılır ve dış API'ye
ihtiyaç duymayan kartlar (hava durumu) yine çalışır.

## Supabase

1. [supabase.com](https://supabase.com) üzerinde ücretsiz proje aç.
2. **SQL Editor** → `supabase/schema.sql` içeriğini çalıştır (tablolar + RLS).
3. **Settings → API** → `Project URL` ve `anon key` değerlerini `.env`'e yaz.
4. **Authentication → Providers → Email** açık olsun (magic link için).
5. **Authentication → Sign-ups**: kayıt olmayı **kapat**, kendini
   **Users → Add user** ile elle ekle. Panel böylece sana özel kalır.

### Edge Function

Kurulu ve `*/15` cron'una bağlı. Kodu değiştirdikten sonra yeniden yayınlamak için:

```bash
npx supabase functions deploy refresh-snapshot --project-ref <proje-ref>
```

Elle tetiklemek için:

```bash
curl -X POST "https://<proje-ref>.supabase.co/functions/v1/refresh-snapshot" \
  -H "Authorization: Bearer <anon-key>"
```

Cron tanımı [supabase/cron.sql](supabase/cron.sql) içinde. `SUPABASE_URL` ve
`SUPABASE_SERVICE_ROLE_KEY` fonksiyona ortamdan otomatik geçer; service_role
anahtarı ne frontend'e ne de cron tanımına konur.

15 dakikalık cron aynı zamanda düzenli veritabanı hareketi ürettiği için
projenin hareketsizlikten duraklatılmasını da engeller.

## Notlar

- Haberler için NewsAPI.org **kullanılmadı**: ücretsiz planı localhost'a kilitli
  ve 24 saat gecikmeli. Yerine RSS okunuyor (limitsiz, anlık).
- `.env` git'e girmez. `.env.example` yalnızca örnek içindir, gerçek değer
  barındırmamalıdır.

## Kaynaklar

| Veri | Servis | Anahtar |
| --- | --- | --- |
| Hava durumu | Open-Meteo | gerekmiyor |
| Konumdan şehir adı | BigDataCloud reverse geocode | gerekmiyor |
| Döviz (resmî) | TCMB günlük XML | gerekmiyor |
| Altın / gümüş | Truncgil v4 | gerekmiyor |
| Haberler | BBC Türkçe / TRT / Hacker News RSS | gerekmiyor |
| Yemek önerisi | Gemini (`gemini-3.5-flash`) | **Supabase secret** |
| Günün sözü | kendi `quotes` tablosu | — |
| Müzik | Spotify Web API | **Supabase secret** |

### Gemini anahtarı

`.env`'e **konmaz**. `VITE_` önekli değişkenler tarayıcı paketine gömülür ve
siteyi açan herkes tarafından okunabilir. Anahtar Supabase secret'ında durur:

```bash
npx supabase secrets set GEMINI_API_KEY=... --project-ref <ref>
```

Yalnızca `suggest-meal` fonksiyonu okur. Fonksiyon `verify_jwt` ile korunduğu
için sadece giriş yapmış kullanıcı çağırabilir.

### Spotify

Kurulum:

1. [developer.spotify.com](https://developer.spotify.com/dashboard) → **Create app**.
   Uygulama sahibi hesabın **Premium** olmalı (Şubat 2026'dan beri Development
   Mode şartı).
2. **Redirect URI** olarak birebir şunu ekle (tek bir adres yeter — callback
   Supabase'de, Netlify'da değil):
   `https://hvcphkcshdjpobihzypj.supabase.co/functions/v1/spotify-callback`
3. Secret'ları tanımla — `client_secret` tarayıcıya **konmaz**:

```bash
npx supabase secrets set \
  SPOTIFY_CLIENT_ID=... \
  SPOTIFY_CLIENT_SECRET=... \
  PANEL_URL=https://poetic-cucurucho-03be49.netlify.app \
  --project-ref <ref>
```

4. `supabase/spotify.sql` dosyasını SQL Editor'de çalıştır.
5. Fonksiyonları yayına al — callback ve senkron JWT **doğrulamasız** olmalı:

```bash
npx supabase functions deploy spotify-connect  --project-ref <ref>
npx supabase functions deploy spotify-now      --project-ref <ref>
npx supabase functions deploy spotify-play     --project-ref <ref>
npx supabase functions deploy spotify-callback --no-verify-jwt --project-ref <ref>
npx supabase functions deploy spotify-sync     --no-verify-jwt --project-ref <ref>
```

6. `supabase/cron.sql` yeniden çalıştırılınca `spotify-sync` de 15 dakikalık
   cron'a girer.
7. Panelde Müzik kartından **Spotify'ı bağla**.

Arşiv anlamlı hale gelmesi için zaman ister: ilk gün sadece son 50 şarkı görünür.

**İzin listesi değişirse yeniden bağlanmak gerekir.** `_shared/spotify.ts`
içindeki `SCOPES` büyüdüğünde eski `refresh_token` yeni izinleri kapsamaz ve
ilgili uçlar 403 döner. Çalma kontrolü eklendiğinde olan tam da budur: Müzik
kartından bir kez daha **Spotify'ı bağla** demek gerekir.

Bağlantı hem canlı panelden hem `localhost:5173`'ten kurulabilir: `spotify-connect`
akışın başladığı adresi `spotify_oauth_state.return_to`'ya yazar, callback oraya
döner. Liste `_shared/spotify.ts` içindeki `returnTarget`'ta; başka bir adres
eklemeden localhost portunu değiştirirsen dönüş canlı panele düşer.

### Bilinen tuzaklar

- **Truncgil**: `User-Agent` göndermeyen isteklere yanıt vermiyor ve TLS
  bağlantısını `close_notify` göndermeden kapatıyor. Gzip'li yanıtta bu, Deno'da
  "error reading a body" hatasına yol açar — bu yüzden `Accept-Encoding: identity`
  ile isteniyor.
- **Gemini**: yeni anahtarlar 2.5 nesline erişemiyor. Ayrıca `gemini-3.5-flash`
  zaman zaman 503 ("high demand") dönüyor; bu yüzden
  [`_shared/gemini.ts`](supabase/functions/_shared/gemini.ts) önce yeniden
  deniyor, ısrarcı hatada `gemini-3.1-flash-lite`'a düşüyor.
- **CORS**: supabase-js `apikey` ve `x-client-info` başlıklarını da gönderir.
  Bunlar `Access-Control-Allow-Headers`'da yoksa tarayıcı preflight'ta isteği
  bloklar ve fonksiyon hiç çağrılmaz — curl ile test ederken bu fark edilmez.
  Ortak liste [`_shared/cors.ts`](supabase/functions/_shared/cors.ts) içinde.
- **saved_meals**: UPDATE politikası bilinçli olarak yok; kayıt `ON CONFLICT DO
  NOTHING` ile yapılır. `upsert` güncellemeye dönseydi RLS'e takılırdı.
- **Yemek önerisi**: `localStorage`'da (`panel:meal`) saklanır. Panel açılışında
  Gemini'ye **istek gitmez**; yeni öneri yalnızca "Başka öner" ile alınır ve
  önbelleği ezer. Görülen tarifler de (`panel:meal-seen`) saklanır, böylece
  yenilemeden sonra aynı tarifler tekrar önerilmez.
- **Spotify — ölü uçlar**: `audio-features`, `audio-analysis`, `recommendations`
  ve `related-artists` 27 Kasım 2024'te yeni uygulamalara kapatıldı, geri
  gelmedi. "Şarkının enerjisine göre ruh hali" tarzı her fikir bu yüzden
  yapılamaz; vibe çıkarımı gerekiyorsa parça/sanatçı adlarıyla Gemini'ye
  sorulmalı. Şubat 2026'da ayrıca toplu `GET /tracks`, `artists/{id}/top-tracks`
  ve `browse/*` kaldırıldı, `search` limiti 50'den 10'a indi.
- **Spotify — refresh_token dönüşümlü**: tazeleme yanıtı bazen *yeni* bir
  `refresh_token` içerir ve eskisini geçersizleştirir. Yazılmazsa bağlantı
  günler sonra sessizce kopar; `_shared/spotify.ts` bu yüzden dönen değeri
  her seferinde üstüne yazar.
- **`spotify_auth` policy'siz**: tabloda RLS açık ama bilerek hiçbir policy
  yok — `authenticated` rolü satırları hiç göremez, yalnızca service_role
  kullanan Edge Function erişir. Panel "bağlı mıyım?" sorusunu tablodan değil
  `spotify-now` yanıtından öğrenir.
- **`spotify-callback` JWT'siz**: tarayıcı oraya Spotify'ın yönlendirmesiyle,
  `Authorization` başlığı olmadan gelir. Güvenlik sınırı `state` parametresi:
  `spotify-connect`'in yazdığı satırla eşleşmeyen istek reddedilir ve state
  okunduğu anda silinir, tekrar oynatılamaz.
- **Playlist aramasında null öğe**: Spotify'ın `search?type=playlist` yanıtında
  `items` dizisi zaman zaman `null` eleman içeriyor. Filtrelenmezse ilk sonuç
  null çıkar ve çalma sessizce başarısız olur — `spotify-play` bu yüzden
  `uri`si olmayan her öğeyi eliyor. `limit` de Şubat 2026'dan beri en fazla 10.
- **Çalma kontrolü ve cihaz**: `PUT /me/player/play`, açık bir Spotify
  istemcisi yoksa 404 döner. Bu bir hata değil, "cihaz seç" durumudur; kart
  `/me/player/devices` listesini gösterip seçimi `localStorage`'a yazar.
  403 ise hesabın Premium olmadığı anlamına gelir.
- **Ruh hali eşleştirmesi elle yazıldı**: `audio-features` kapandığı için
  hava kodu → arama sözcüğü eşlemesi [`lib/playback.ts`](src/lib/playback.ts)
  içinde sabit. Gemini'ye de sorulabilirdi ama çalma düğmesine basınca 3-5
  saniye beklemek ve ara sıra 503 yemek anlamına gelirdi.
- **Odak seansı bitiş anını saklar, süreyi değil**: `panel:focus-until`
  içinde bitiş zaman damgası durur; sekme kapanıp açılsa da sayaç doğru
  devam eder. Sekme kapalıyken dolmuş seans sessizce temizlenir — müziği
  çok sonradan durdurmak şaşırtıcı olurdu.
- **`plays` birincil anahtarı `(user_id, played_at)`**: `recently-played`
  pencereleri üst üste bindiği için senkron aynı çalmayı tekrar tekrar görür;
  tekrar yazımı engelleyen tek şey bu anahtar.
- **Alışveriş listesi**: malzeme eklemek tek yerden,
  [`lib/shopping.ts`](src/lib/shopping.ts) üzerinden yapılır. Aynı malzemeyi
  panelden ve `/tarifler`den eklemek tekrar üretmesin diye listede duran
  (alınmamış) ürünler ayıklanır. Veritabanında unique index **yok**: "alındı"
  işaretli ürün tekrar eklenebilmeli, kısmi unique index'i de PostgREST'in
  `on_conflict`'i çıkaramıyor. Ayıklama bu yüzden uygulama tarafında.

## Durum

- [x] Hava durumu kartı (konum izniyle, şehir seçimi yedekli)
- [x] Döviz kartı (`snapshots.rates`)
- [x] Altın/gümüş kartı (`snapshots.gold`)
- [x] Haber kartı (`snapshots.news`)
- [x] Günün sözü kartı (40 söz havuzu)
- [x] Hızlı not kartı + ayrı `/notlar` sayfası (arama, sabitleme, düzenleme)
- [x] "Bugün ne yesem?" kartı (Gemini) — beğenilen tariflere göre kişiselleşir
- [x] Alışveriş listesi + tarif malzemelerini tek tıkla ekleme
- [x] Kayıtlı tarifler sayfası (`/tarifler`)
- [x] Notlarda Gemini: maddelere bölme (✨) ve toplu özet
- [x] Not hatırlatmaları (`remind_on`) — günü gelince panelde öne çıkar
- [x] Kart sırası ve görünürlüğü (sürükle-bırak, `prefs` tablosunda saklanır)
- [x] Açık tema
- [x] PWA (ana ekrana ekle)
- [x] `refresh-snapshot` deploy + 15 dakikalık cron
- [x] Spotify: çalan şarkı kartı, dinleme arşivi (`/muzik`), notlara şarkı damgası
- [x] Havaya göre çalma, sabah rutini (Müzik kartı) ve odak seansı (Odak kartı)

## Sayfalar

| Yol | İçerik |
| --- | --- |
| `/` | Panel — kartlar |
| `/notlar` | Not defteri: arama, sabitleme, düzenleme, hatırlatma, Gemini |
| `/tarifler` | Kaydedilen tarifler |
| `/muzik` | Dinleme arşivi: ısı haritası, aylık zirveler, geçen sene bugün |
