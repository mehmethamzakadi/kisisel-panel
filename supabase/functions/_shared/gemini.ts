// Gemini çağrısı: geçici hatalarda yeniden dener, ısrarcı hatada sıradaki
// modele düşer.
//
// Neden zincir: gemini-3.5-flash zaman zaman 503 ("high demand") dönüyor.
// Tek modele bağlı kalmak, kartın Google'ın o anki yüküne göre çalışıp
// çalışmaması demek. Sıradaki model daha küçük ama bu iş için yeterli.

export const MODEL_CHAIN = ['gemini-3.5-flash', 'gemini-3.1-flash-lite']

const RETRYABLE = new Set([429, 500, 502, 503, 504])

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Result =
  | { ok: true; text: string; model: string }
  | { ok: false; status: number; detail: string }

export async function callGemini(
  apiKey: string,
  body: unknown,
  models: string[] = MODEL_CHAIN,
  attemptsPerModel = 2,
): Promise<Result> {
  let last = { status: 0, detail: 'bilinmeyen hata' }

  for (const model of models) {
    for (let i = 0; i < attemptsPerModel; i++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )

      if (res.ok) {
        const json = await res.json()
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
        if (text) return { ok: true, text, model }
        last = { status: 502, detail: 'Gemini boş yanıt döndü' }
      } else {
        last = { status: res.status, detail: (await res.text()).slice(0, 200) }
        // Kalıcı hatada (400, 404 gibi) başka model de kurtarmaz.
        if (!RETRYABLE.has(res.status)) return { ok: false, ...last }
      }

      if (i < attemptsPerModel - 1) await sleep(500 * 2 ** i)
    }
  }

  return { ok: false, ...last }
}
