import type { Point } from '../lib/history'

type Props = {
  points: Point[] | undefined
  className?: string
}

const WIDTH = 64
const HEIGHT = 20
// Çizgi kalınlığının yarısı kadar pay: uçtaki nokta tepedeyse kırpılmasın.
const PAD = 1.5

/**
 * Küçük trend çizgisi. Eksen, etiket, tooltip yok — bu bir grafik değil,
 * "yukarı mı gidiyor aşağı mı" sorusunun tek bakışlık cevabı.
 *
 * Renk yöne göre: yükselişte yeşil, düşüşte kırmızı. Değerin kendisi zaten
 * satırda yazıyor, sparkline yalnızca biçimi taşıyor.
 */
export function Sparkline({ points, className }: Props) {
  if (!points || points.length < 2) return null

  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min

  const path = values
    .map((value, i) => {
      const x = (i / (values.length - 1)) * WIDTH
      // Düz çizgide (span 0) ortadan geçsin, sıfıra bölme de olmasın.
      const ratio = span === 0 ? 0.5 : (value - min) / span
      const y = HEIGHT - PAD - ratio * (HEIGHT - PAD * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const rising = values[values.length - 1] >= values[0]

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      aria-hidden
      className={className}
      preserveAspectRatio="none"
    >
      <polyline
        points={path}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={rising ? 'stroke-up' : 'stroke-down'}
      />
    </svg>
  )
}
