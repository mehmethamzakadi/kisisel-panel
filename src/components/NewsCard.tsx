import { useMemo } from 'react'
import { Card } from './Card'
import { formatUpdatedAt, useSnapshot } from '../lib/useSnapshot'
import { timeAgo, timestamp } from '../lib/time'
import type { Headline } from '../../supabase/functions/_shared/wire'

// Kaynak rozetleri renkle ayrışsın: dört sütuna yayılmış başlıklarda hangi
// haberin nereden geldiği yoksa okunmuyor.
const sourceStyle: Record<string, string> = {
  'BBC Türkçe': 'bg-down/10 text-down',
  'TRT Haber': 'bg-accent-soft text-accent',
  'Hacker News': 'bg-up/10 text-up',
}

export function NewsCard() {
  const { data, updatedAt, error } = useSnapshot<{ headlines: Headline[] }>(
    'news',
  )

  // Kaynaklar sırayla ekleniyor (önce BBC, sonra TRT…). Güncelliği görebilmek
  // için yayın saatine göre yeniden sıralanıyor.
  const headlines = useMemo(() => {
    if (!data) return []
    return [...data.headlines]
      .sort((a, b) => timestamp(b.date) - timestamp(a.date))
      .slice(0, 8)
  }, [data])

  return (
    <Card
      title="Gündem"
      icon="📰"
      loading={!data && !error}
      error={error}
      meta={formatUpdatedAt(updatedAt)}
    >
      {/* Kart tam genişlikte; başlıklar tek sütuna dizilse kart diğerlerinin
          iki katı uzardı. Eşit sütunlara yayılıyorlar.
          Ayırıcı olarak divide-y kullanılamaz — grid'de satır/sütun
          sınırlarını takip etmez; her öğe kendi üst çizgisini taşıyor. */}
      <ul className="grid gap-x-5 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
        {headlines.map((item) => {
          const ago = timeAgo(item.date)
          return (
            <li key={item.link} className="border-t border-edge">
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex h-full flex-col gap-2 rounded-lg px-2 py-3 transition-colors hover:bg-panel"
              >
                <span className="flex items-center gap-2 text-[11px]">
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      sourceStyle[item.source] ?? 'bg-panel text-muted'
                    }`}
                  >
                    {item.source}
                  </span>
                  {ago && <span className="text-muted">{ago}</span>}
                </span>

                {/* Üç satırda kesiliyor: başlık uzunlukları çok değişken ve
                    kırpılmazsa grid hücreleri tırtıklı duruyor. */}
                <span className="line-clamp-3 text-sm leading-snug transition-colors group-hover:text-accent">
                  {item.title}
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
