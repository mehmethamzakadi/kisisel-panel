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
      <ul className="flex flex-col divide-y divide-edge">
        {headlines.map((item, i) => {
          const ago = timeAgo(item.date)
          return (
            <li key={item.link} className={i === 0 ? 'pb-3.5' : 'py-3.5 last:pb-0'}>
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
