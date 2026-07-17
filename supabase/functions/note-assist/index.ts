// Notlar için Gemini yardımcısı: tek notu maddelere böler ya da birden çok
// notu özetler. Anahtar Supabase secret'ında kalır, tarayıcıya gitmez.
//
// Yayına alma: supabase functions deploy note-assist

import { cors } from '../_shared/cors.ts'
import { callGemini } from '../_shared/gemini.ts'

type Action = 'bulletize' | 'summarize'

function buildPrompt(action: Action, texts: string[]): string {
  if (action === 'bulletize') {
    return `Aşağıdaki dağınık notu, uygulanabilir maddelere böl.

Kurallar:
- Her madde tek satır, "- " ile başlasın.
- Yeni bilgi uydurma; yalnızca nottaki içeriği düzenle.
- Türkçe yaz, kısa ve net ol.
- Sadece maddeleri döndür, başlık veya açıklama ekleme.

Not:
${texts[0]}`
  }

  return `Aşağıdaki notlarımı özetle.

Kurallar:
- Önce 2-3 cümlelik kısa bir genel özet yaz.
- Sonra "Öne çıkanlar:" başlığı altında en fazla 5 madde listele.
- Tekrar edenleri birleştir, yeni bilgi uydurma.
- Türkçe yaz.

Notlar:
${texts.map((t, i) => `${i + 1}. ${t}`).join('\n')}`
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

  let action: Action = 'bulletize'
  let texts: string[] = []

  try {
    const body = await req.json()
    if (body?.action === 'summarize') action = 'summarize'
    if (Array.isArray(body?.texts)) {
      texts = body.texts.filter((t: unknown) => typeof t === 'string').slice(0, 40)
    }
  } catch {
    // aşağıdaki doğrulama yakalar
  }

  if (texts.length === 0) {
    return Response.json({ error: 'Metin gönderilmedi' }, { status: 400, headers: cors })
  }

  const out = await callGemini(apiKey, {
    contents: [{ parts: [{ text: buildPrompt(action, texts) }] }],
    generationConfig: { temperature: 0.4 },
  })

  if (!out.ok) {
    return Response.json(
      { error: `Gemini ${out.status}`, detail: out.detail },
      { status: 502, headers: cors },
    )
  }

  return Response.json({ action, result: out.text }, { headers: cors })
})
