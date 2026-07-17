const clock = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit',
})

const dayClock = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
})

/**
 * RSS pubDate'i "az önce / 5 dk / 3 sa / dün 14:30 / 12 Tem" gibi kısa bir
 * güncellik etiketine çevirir. Kaynaklar RFC-822 kullanıyor (GMT, +0000, +0300);
 * hepsi Date ile çözülüyor. Çözülemeyen tarihte null döner ve etiket gösterilmez.
 */
export function timeAgo(input: string | null | undefined): string | null {
  if (!input) return null

  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return null

  const diffMs = Date.now() - date.getTime()

  // İleri tarihli damga (kaynak saati kaymış olabilir) — "az önce" göster.
  if (diffMs < 0) return 'az önce'

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'az önce'
  if (minutes < 60) return `${minutes} dk önce`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} sa önce`

  const days = Math.floor(hours / 24)
  if (days === 1) return `dün ${clock.format(date)}`
  if (days < 7) return `${days} gün önce`

  return dayClock.format(date)
}

/** Sıralama için ham zaman damgası; çözülemezse en eskiye düşer. */
export function timestamp(input: string | null | undefined): number {
  if (!input) return 0
  const t = new Date(input).getTime()
  return Number.isNaN(t) ? 0 : t
}
