// Dinleme arşivinden aylık anlatı üretir — kendi "Wrapped"ın.
//
// İstatistikleri panel hesaplayıp gönderiyor: veriler zaten /muzik sayfasında
// çıkarılıyor, ikinci kez sorgulamanın anlamı yok. Fonksiyonun tek işi bu
// sayıları Gemini'ye anlamlı bir metne çevirtmek.
//
// Yayına alma: supabase functions deploy music-recap

import { cors } from '../_shared/cors.ts'
import { callGemini } from '../_shared/gemini.ts'

type Pair = [string, number]

function list(pairs: Pair[]): string {
  return pairs.map(([name, count]) => `${name} (${count})`).join(', ')
}

function prompt(body: {
  total: number
  artists: Pair[]
  tracks: Pair[]
  peak: string | null
}) {
  const peak = body.peak ? `\nEn yoğun dinleme zamanı: ${body.peak}.` : ''

  return `Aşağıda son 30 günlük Spotify dinleme istatistiklerim var. Bunları bana anlatan kısa bir özet yaz.

Toplam çalma: ${body.total}
En çok dinlenen sanatçılar: ${list(body.artists)}
En çok dinlenen şarkılar: ${list(body.tracks)}${peak}

Kurallar:
- Türkçe yaz, 2-3 cümle, en fazla 60 kelime.
- Sayıları tek tek tekrarlama; ne anlama geldiklerini söyle.
- Alışkanlık hakkında bir gözlem yap (örneğin bir sanatçıya yoğunlaşma, gece dinleme eğilimi).
- Abartılı övgü, emoji ve "Wrapped" kelimesini kullanma.
- Doğrudan özetle başla, "İşte özetin" gibi giriş cümlesi kurma.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    return Response.json(
      { error: 'GEMINI_API_KEY tanımlı değil' },
      { status: 500, headers: cors },
    )
  }

  let body: { total?: number; artists?: Pair[]; tracks?: Pair[]; peak?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Gövde okunamadı' }, { status: 400, headers: cors })
  }

  const artists = (body.artists ?? []).slice(0, 5)
  const tracks = (body.tracks ?? []).slice(0, 5)

  // Birkaç kayıtla üretilen "özet" uydurma olur; kart bunu zaten gizliyor
  // ama fonksiyon da kendi başına korunsun.
  if (artists.length === 0 || !body.total) {
    return Response.json(
      { error: 'not-enough-data' },
      { headers: cors },
    )
  }

  const out = await callGemini(apiKey, {
    contents: [
      {
        parts: [
          {
            text: prompt({
              total: body.total,
              artists,
              tracks,
              peak: body.peak ?? null,
            }),
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.9 },
  })

  if (!out.ok) {
    return Response.json(
      { error: `Gemini ${out.status}`, detail: out.detail },
      { status: 502, headers: cors },
    )
  }

  return Response.json({ text: out.text }, { headers: cors })
})
