import { Card } from './Card'
import { Sparkline } from './Sparkline'
import { formatUpdatedAt, useSnapshot } from '../lib/useSnapshot'
import { changePct, useHistory } from '../lib/history'

import type { Rate } from '../../supabase/functions/_shared/wire'

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
  // TCMB değişim yüzdesi vermiyor; 7 günlük fark kendi geçmişimizden geliyor.
  const history = useHistory('rate')

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
            {data.rates.map((rate) => {
              const week = changePct(history[rate.code])

              return (
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

                <span className="flex shrink-0 items-center gap-2.5">
                  {/* Dar ekranda satır sıkışıyor; trend orada gizleniyor. */}
                  <Sparkline
                    points={history[rate.code]}
                    className="hidden shrink-0 sm:block"
                  />

                  <span className="text-right">
                    <span className="block text-lg font-semibold tabular-nums">
                      {money.format(rate.selling)} ₺
                    </span>
                    {/* Haftalık değişim varsa alış yerine o gösteriliyor:
                        ikisi birden satırı kalabalıklaştırıyor ve trend
                        günlük alış fiyatından daha çok şey söylüyor. */}
                    {week === null ? (
                      <span className="block text-xs text-muted tabular-nums">
                        alış {money.format(rate.buying)} ₺
                      </span>
                    ) : (
                      <span
                        className={`block text-xs tabular-nums ${
                          week > 0 ? 'text-up' : week < 0 ? 'text-down' : 'text-muted'
                        }`}
                      >
                        {week > 0 ? '▲' : week < 0 ? '▼' : '—'} %
                        {Math.abs(week).toFixed(2)} · 7 gün
                      </span>
                    )}
                  </span>
                </span>
              </li>
              )
            })}
          </ul>

          <p className="mt-auto border-t border-edge pt-3 text-xs text-muted">
            TCMB efektif satış kuru
          </p>
        </div>
      )}
    </Card>
  )
}
