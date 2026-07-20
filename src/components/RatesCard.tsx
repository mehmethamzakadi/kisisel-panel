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

// TCMB adları büyük harf geliyor ("ABD DOLARI"); kartta okunaklı karşılıkları
// kullanılıyor. Listede olmayan kod gelirse TCMB'nin kendi adına düşülür.
const names: Record<string, string> = {
  USD: 'Amerikan Doları',
  EUR: 'Euro',
  GBP: 'İngiliz Sterlini',
}

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
        <div className="flex flex-1 flex-col">
          <ul className="flex flex-col gap-1">
            {data.rates.map((rate) => (
              <li
                key={rate.code}
                className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-panel"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
                  >
                    {symbols[rate.code] ?? '¤'}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {rate.code}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {names[rate.code] ?? rate.name}
                    </span>
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block text-lg font-semibold tabular-nums">
                    {money.format(rate.selling)} ₺
                  </span>
                  {/* Alış/satış farkı tek satırda: hangi yönde işlem
                      yapılacağı bilinmediği için ikisi de gösteriliyor. */}
                  <span className="block text-xs text-muted tabular-nums">
                    alış {money.format(rate.buying)} ₺
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-auto border-t border-edge pt-3 text-xs text-muted">
            TCMB efektif satış kuru
          </p>
        </div>
      )}
    </Card>
  )
}
