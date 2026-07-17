import { Card } from './Card'
import { formatUpdatedAt, useSnapshot } from '../lib/useSnapshot'

type Rate = { code: string; name: string; buying: number; selling: number }

const money = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// Bayrak emojileri Windows'ta render edilmiyor (harf kodlarına düşüyor),
// bu yüzden para birimi sembolü kullanılıyor.
const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' }

export function RatesCard() {
  const { data, updatedAt, error } = useSnapshot<{ rates: Rate[] }>('rates')

  return (
    <Card
      title="Döviz"
      icon="💱"
      loading={!data && !error}
      error={error}
      meta={formatUpdatedAt(updatedAt)}
    >
      {data && (
        <ul className="flex flex-col gap-3">
          {data.rates.map((rate) => (
            <li key={rate.code} className="flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
                >
                  {symbols[rate.code] ?? '¤'}
                </span>
                <span className="text-sm font-medium">{rate.code}</span>
              </span>
              <span className="text-right">
                <span className="text-lg font-semibold tabular-nums">
                  {money.format(rate.selling)} ₺
                </span>
                <span className="block text-xs text-muted tabular-nums">
                  alış {money.format(rate.buying)}
                </span>
              </span>
            </li>
          ))}
          <li className="border-t border-edge pt-2 text-xs text-muted">
            TCMB efektif satış kuru
          </li>
        </ul>
      )}
    </Card>
  )
}
