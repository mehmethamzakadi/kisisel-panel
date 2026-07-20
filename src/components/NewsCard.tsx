import { useMemo } from 'react'
import { Card } from './Card'
import { formatUpdatedAt, useSnapshot } from '../lib/useSnapshot'
import { timeAgo, timestamp } from '../lib/time'

type Headline = {
  source: string
  title: string
  link: string
  date: string | null
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
      {/* Kart tam genişlikte duruyor; başlıklar tek sütuna dizilse kart
          diğerlerinin iki katı uzardı. Eşit sütunlara yayılıyorlar.
          Ayırıcı olarak divide-y kullanılamaz — grid'de satır/sütun
          sınırlarını takip etmez; her öğe kendi üst çizgisini taşıyor. */}
      <ul className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {headlines.map((item) => {
          const ago = timeAgo(item.date)
          return (
            <li key={item.link} className="border-t border-edge pt-3.5">
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer noopener"
                className="group block"
              >
                <p className="text-sm leading-snug transition-colors group-hover:text-accent">
                  {item.title}
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                  <span>{item.source}</span>
                  {ago && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{ago}</span>
                    </>
                  )}
                </p>
              </a>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
