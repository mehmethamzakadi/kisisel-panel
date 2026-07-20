// Dış API'leri sunucu tarafında çağırır, sonucu snapshots tablosuna yazar.
// Panel bu tabloyu okur; böylece anahtarlar tarayıcıya sızmaz, CORS derdi
// olmaz ve ücretsiz kotalar kullanıcı sayısından bağımsız kalır.
//
// Yerel çalıştırma:  supabase functions serve refresh-snapshot
// Yayına alma:       supabase functions deploy refresh-snapshot

import { createClient } from 'jsr:@supabase/supabase-js@2'

const TCMB_URL = 'https://www.tcmb.gov.tr/kurlar/today.xml'
const TRUNCGIL_URL = 'https://finans.truncgil.com/v4/today.json'

// Truncgil, User-Agent göndermeyen isteklerde bağlantıyı kapatıyor.
const UA = 'Mozilla/5.0 (compatible; PanelimBot/1.0)'

const GOLD_LABELS: Record<string, string> = {
  GRA: 'Gram Altın',
  CEYREKALTIN: 'Çeyrek Altın',
  YARIMALTIN: 'Yarım Altın',
  TAMALTIN: 'Tam Altın',
  CUMHURIYETALTINI: 'Cumhuriyet Altını',
  GUMUS: 'Gümüş',
}

const FEEDS = [
  { source: 'BBC Türkçe', url: 'https://feeds.bbci.co.uk/turkce/rss.xml' },
  { source: 'TRT Haber', url: 'https://www.trthaber.com/sondakika.rss' },
  { source: 'Hacker News', url: 'https://hnrss.org/frontpage' },
]

type Rate = { code: string; name: string; buying: number; selling: number }
type Gold = { code: string; label: string; selling: number; change: number }
type Headline = { source: string; title: string; link: string; date: string | null }

function tag(xml: string, name: string): string | null {
  const match = xml.match(
    new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'),
  )
  if (!match) return null
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

async function fetchRates(): Promise<Rate[]> {
  const res = await fetch(TCMB_URL)
  if (!res.ok) throw new Error(`TCMB ${res.status}`)
  const xml = await res.text()

  const wanted = ['USD', 'EUR', 'GBP']
  const rates: Rate[] = []

  for (const block of xml.match(/<Currency[\s\S]*?<\/Currency>/g) ?? []) {
    const code = block.match(/CurrencyCode="([^"]+)"/)?.[1]
    if (!code || !wanted.includes(code)) continue

    const buying = Number(tag(block, 'ForexBuying'))
    const selling = Number(tag(block, 'ForexSelling'))
    if (!buying || !selling) continue

    rates.push({
      code,
      name: tag(block, 'Isim') ?? code,
      buying,
      selling,
    })
  }

  return rates
}

async function fetchGold(): Promise<Gold[]> {
  // Truncgil bağlantıyı TLS close_notify göndermeden kapatıyor. Gzip'li yanıtta
  // bu, akışın sonunu bozup Deno'da "error reading a body" hatasına yol açıyor;
  // sıkıştırmasız istendiğinde gövde eksiksiz geliyor.
  const res = await fetch(TRUNCGIL_URL, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      'Accept-Encoding': 'identity',
    },
  })
  if (!res.ok) throw new Error(`Truncgil ${res.status}`)
  const json = await res.json()

  return Object.entries(GOLD_LABELS).flatMap(([code, label]) => {
    const item = json[code]
    const selling = Number(item?.Selling)
    // Truncgil bazı kalemleri 0 döndürüyor; boş kart göstermemek için elenir.
    if (!selling) return []
    return [{ code, label, selling, change: Number(item?.Change ?? 0) }]
  })
}

async function fetchHeadlines(): Promise<Headline[]> {
  const results = await Promise.allSettled(
    FEEDS.map(async ({ source, url }) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${source} ${res.status}`)
      const xml = await res.text()

      return (xml.match(/<item[\s\S]*?<\/item>/g) ?? [])
        .slice(0, 5)
        .flatMap((item) => {
          const title = tag(item, 'title')
          const link = tag(item, 'link')
          if (!title || !link) return []
          return [{ source, title, link, date: tag(item, 'pubDate') }]
        })
    }),
  )

  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}

/**
 * Fiyatları geçmiş tablosuna ekler.
 *
 * bucket saat başına yuvarlanıyor ve (kind, code, bucket) birincil anahtar;
 * ignoreDuplicates ile saatte yalnızca ilk yazım giriyor. 15 dakikalık cron
 * dört kez denese de tablo şişmiyor ve "son kayıt neydi" sorgusu gerekmiyor.
 */
async function recordHistory(
  supabase: ReturnType<typeof createClient>,
  rows: { kind: string; code: string; value: number }[],
) {
  if (rows.length === 0) return

  const bucket = new Date()
  bucket.setMinutes(0, 0, 0)

  const { error } = await supabase.from('rate_history').upsert(
    rows.map((r) => ({ ...r, bucket: bucket.toISOString() })),
    { onConflict: 'kind,code,bucket', ignoreDuplicates: true },
  )

  // Geçmiş yazımı yan iş: hata verse de snapshot güncellemesi sürmeli.
  if (error) console.error('rate_history', error.message)
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const [rates, gold, headlines] = await Promise.allSettled([
    fetchRates(),
    fetchGold(),
    fetchHeadlines(),
  ])

  const rows = []
  const history: { kind: string; code: string; value: number }[] = []

  if (rates.status === 'fulfilled') {
    rows.push({ key: 'rates', payload: { rates: rates.value } })
    for (const r of rates.value) {
      history.push({ kind: 'rate', code: r.code, value: r.selling })
    }
  }
  if (gold.status === 'fulfilled') {
    rows.push({ key: 'gold', payload: { gold: gold.value } })
    for (const g of gold.value) {
      history.push({ kind: 'gold', code: g.code, value: g.selling })
    }
  }

  await recordHistory(supabase, history)
  if (headlines.status === 'fulfilled') {
    rows.push({ key: 'news', payload: { headlines: headlines.value } })
  }

  // Tek kaynak çökerse diğerinin taze verisi korunur; hiçbiri gelmezse hata döner.
  if (rows.length === 0) {
    return Response.json({ error: 'Hiçbir kaynak yanıt vermedi' }, { status: 502 })
  }

  const { error } = await supabase
    .from('snapshots')
    .upsert(
      rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
      { onConflict: 'key' },
    )

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({
    updated: rows.map((r) => r.key),
    rates: rates.status === 'rejected' ? String(rates.reason) : 'ok',
    gold: gold.status === 'rejected' ? String(gold.reason) : 'ok',
    news: headlines.status === 'rejected' ? String(headlines.reason) : 'ok',
  })
})
