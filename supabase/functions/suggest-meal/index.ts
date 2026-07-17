// "Bugün ne yesem?" önerisi üretir.
//
// Gemini anahtarı yalnızca burada, Supabase secret'ında durur; tarayıcıya
// hiçbir zaman gönderilmez. verify_jwt açık olduğu için fonksiyonu yalnızca
// giriş yapmış kullanıcı çağırabilir — anahtar üçüncü kişilerce kullanılamaz.
//
// Yayına alma: supabase functions deploy suggest-meal

import { cors } from '../_shared/cors.ts'
import { callGemini } from '../_shared/gemini.ts'

const schema = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    summary: { type: 'STRING' },
    minutes: { type: 'INTEGER' },
    ingredients: { type: 'ARRAY', items: { type: 'STRING' } },
    steps: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['name', 'summary', 'minutes', 'ingredients', 'steps'],
}

function prompt(meal: string, avoid: string[], liked: string[]) {
  const exclude = avoid.length
    ? `\nŞu tarifleri önerme (yakın zamanda önerildi): ${avoid.join(', ')}.`
    : ''

  // Kaydedilen tarifler zevk sinyali; aynısını değil, benzerini istiyoruz.
  const taste = liked.length
    ? `\nDaha önce şu tarifleri beğenip kaydettim: ${liked.join(', ')}. Bunlara benzer tarzda bir şey öner ama aynısını önerme.`
    : ''

  return `Türk mutfağından, ${meal} için pratik bir yemek öner.

Kurallar:
- Hazırlanışı 30 dakikayı geçmesin.
- Aperatif, atıştırmalık veya tek tavada yapılabilecek türden olsun.
- Malzemeler Türkiye'de her markette bulunabilsin, egzotik malzeme olmasın.
- Adımlar kısa ve uygulanabilir olsun (en fazla 6 adım).
- Malzemeleri alışveriş listesine eklenebilecek şekilde yaz (miktar + malzeme).
- Tarif adı ve tüm metinler Türkçe olsun.${exclude}${taste}`
}

function mealOfDay(): string {
  // Türkiye saati (UTC+3) — sunucu UTC çalışıyor.
  const hour = (new Date().getUTCHours() + 3) % 24
  if (hour < 11) return 'kahvaltı'
  if (hour < 16) return 'öğle yemeği'
  if (hour < 22) return 'akşam yemeği'
  return 'gece atıştırmalığı'
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

  let avoid: string[] = []
  let liked: string[] = []
  try {
    const body = await req.json()
    if (Array.isArray(body?.avoid)) avoid = body.avoid.slice(0, 8).map(String)
    if (Array.isArray(body?.liked)) liked = body.liked.slice(0, 8).map(String)
  } catch {
    // gövdesiz çağrı da geçerli
  }

  const meal = mealOfDay()

  const out = await callGemini(apiKey, {
    contents: [{ parts: [{ text: prompt(meal, avoid, liked) }] }],
    generationConfig: {
      temperature: 1.3, // her çağrıda farklı öneri gelsin
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  })

  if (!out.ok) {
    return Response.json(
      { error: `Gemini ${out.status}`, detail: out.detail },
      { status: 502, headers: cors },
    )
  }

  try {
    return Response.json({ meal, suggestion: JSON.parse(out.text) }, { headers: cors })
  } catch {
    return Response.json(
      { error: 'Yanıt JSON olarak çözülemedi' },
      { status: 502, headers: cors },
    )
  }
})
