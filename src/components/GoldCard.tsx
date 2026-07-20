import { Card } from './Card'
import { Sparkline } from './Sparkline'
import { formatUpdatedAt, useSnapshot } from '../lib/useSnapshot'
import { useHistory } from '../lib/history'

type Gold = { code: string; label: string; selling: number; change: number }

const money = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function GoldCard() {
  const { data, updatedAt, error } = useSnapshot<{ gold: Gold[] }>('gold')
  // Truncgil'in `change` alanı günlük; sparkline 7 günlük kendi geçmişimizden.
  const history = useHistory('gold')

  return (
    <Card
      title="Altın"
      icon="🥇"
      loading={!data && !error}
      error={error}
      meta={formatUpdatedAt(updatedAt)}
    >
      {data && (
        <ul className="flex flex-col gap-2.5">
          {data.gold.map((item) => (
            <li key={item.code} className="flex items-center justify-between gap-2">
              <span className="text-sm">{item.label}</span>
              <span className="flex items-center gap-2.5">
                {/* Dar ekranda satır sıkışıyor; trend orada gizleniyor. */}
                <Sparkline
                  points={history[item.code]}
                  className="hidden shrink-0 sm:block"
                />
                <span className="font-semibold tabular-nums">
                  {money.format(item.selling)} ₺
                </span>
                <span
                  className={`w-14 text-right text-xs tabular-nums ${
                    item.change > 0
                      ? 'text-up'
                      : item.change < 0
                        ? 'text-down'
                        : 'text-muted'
                  }`}
                >
                  {item.change > 0 ? '▲' : item.change < 0 ? '▼' : '—'}{' '}
                  {item.change !== 0 && `%${Math.abs(item.change).toFixed(2)}`}
                </span>
              </span>
            </li>
          ))}
          <li className="border-t border-edge pt-2 text-xs text-muted">
            Serbest piyasa satış fiyatı
          </li>
        </ul>
      )}
    </Card>
  )
}
