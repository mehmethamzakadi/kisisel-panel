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

### Gemini anahtarı

`.env`'e **konmaz**. `VITE_` önekli değişkenler tarayıcı paketine gömülür ve
siteyi açan herkes tarafından okunabilir. Anahtar Supabase secret'ında durur:

```bash
npx supabase secrets set GEMINI_API_KEY=... --project-ref <ref>
```

Yalnızca `suggest-meal` fonksiyonu okur. Fonksiyon `verify_jwt` ile korunduğu
için sadece giriş yapmış kullanıcı çağırabilir.

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

## Sayfalar

| Yol | İçerik |
| --- | --- |
| `/` | Panel — kartlar |
| `/notlar` | Not defteri: arama, sabitleme, düzenleme, hatırlatma, Gemini |
| `/tarifler` | Kaydedilen tarifler |
