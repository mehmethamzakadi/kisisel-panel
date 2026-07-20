import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BackIcon } from '../components/icons'
import type { Play } from '../lib/spotify'

// Isı haritası ve listeler için okunan pencere. Arşiv büyüdükçe tamamını
// çekmenin anlamı yok; alışkanlık için son üç ay fazlasıyla yeterli.
const WINDOW_DAYS = 90
const ROW_LIMIT = 5000

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

const stamp = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const timeOnly = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit',
})

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000)
}

/** Date.getDay() pazardan başlar; ızgara pazartesiden başlasın. */
function weekIndex(date: Date) {
  return (date.getDay() + 6) % 7
}

function tally(list: string[]) {
  const counts = new Map<string, number>()
  for (const key of list) counts.set(key, (counts.get(key) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

export function MusicPage() {
  const [plays, setPlays] = useState<Play[] | null>(null)
  const [flashback, setFlashback] = useState<Play[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setError('Supabase yapılandırılmadı.')
      return
    }

    let cancelled = false
    const client = supabase

    async function load() {
      // Geçen yılın aynı günü ayrı sorgu: 90 günlük pencerenin dışında kalıyor.
      const lastYear = new Date()
      lastYear.setFullYear(lastYear.getFullYear() - 1)
      const dayStart = new Date(lastYear)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(lastYear)
      dayEnd.setHours(23, 59, 59, 999)

      const [recentRes, backRes] = await Promise.all([
        client
          .from('plays')
          .select('played_at, track, artist, art, url')
          .gte('played_at', daysAgo(WINDOW_DAYS).toISOString())
          .order('played_at', { ascending: false })
          .limit(ROW_LIMIT),
        client
          .from('plays')
          .select('played_at, track, artist, art, url')
          .gte('played_at', dayStart.toISOString())
          .lte('played_at', dayEnd.toISOString())
          .order('played_at', { ascending: false })
          .limit(20),
      ])

      if (cancelled) return

      if (recentRes.error) setError(recentRes.error.message)
      else setPlays(recentRes.data as Play[])

      if (backRes.data) setFlashback(backRes.data as Play[])
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => {
    if (!plays) return null

    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    let peak = 0

    for (const play of plays) {
      const at = new Date(play.played_at)
      const cell = ++grid[weekIndex(at)][at.getHours()]
      if (cell > peak) peak = cell
    }

    const monthStart = daysAgo(30).toISOString()
    const month = plays.filter((p) => p.played_at >= monthStart)

    return {
      grid,
      peak,
      month: month.length,
      artists: tally(month.map((p) => p.artist)).slice(0, 5),
      tracks: tally(month.map((p) => `${p.track} — ${p.artist}`)).slice(0, 5),
      since: plays.length ? plays[plays.length - 1].played_at : null,
    }
  }, [plays])

  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl p-4 sm:p-6">
      <header className="mb-6 flex items-center gap-3">
        <Link
          to="/"
          aria-label="Panele dön"
          className="flex size-9 items-center justify-center rounded-xl border border-edge/80 bg-card text-muted transition-colors hover:text-ink"
        >
          <BackIcon />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Müzik arşivi</h1>
          <p className="mt-0.5 text-sm text-muted">
            {plays
              ? `${plays.length.toLocaleString('tr-TR')} çalma · son ${WINDOW_DAYS} gün`
              : 'Yükleniyor…'}
          </p>
        </div>
      </header>

      {error && <p className="mb-3 text-sm text-down">{error}</p>}

      {plays?.length === 0 && (
        <p className="rounded-xl border border-dashed border-edge py-10 text-center text-sm text-muted">
          Arşiv henüz boş. spotify-sync çalıştıkça dolmaya başlar.
        </p>
      )}

      {stats && plays!.length > 0 && (
        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border border-edge/80 bg-card p-5">
            <h2 className="mb-1 text-sm font-semibold">Ne zaman dinliyorsun?</h2>
            <p className="mb-4 text-xs text-muted">
              Saat × gün — koyu hücre yoğun dinleme.
            </p>

            <div className="overflow-x-auto">
              <div className="min-w-[520px]">
                {stats.grid.map((row, day) => (
                  <div key={day} className="flex items-center gap-1.5">
                    <span className="w-8 shrink-0 text-right text-[10px] text-muted">
                      {DAYS[day]}
                    </span>
                    <div className="flex flex-1 gap-[2px]">
                      {row.map((count, hour) => (
                        <div
                          key={hour}
                          title={`${DAYS[day]} ${hour}:00 — ${count} çalma`}
                          className="h-4 flex-1 rounded-[3px] bg-accent"
                          // Boş saatler tamamen kaybolmasın diye taban 0.06.
                          style={{
                            opacity: count
                              ? 0.25 + 0.75 * (count / stats.peak)
                              : 0.06,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                <div className="mt-1.5 flex gap-[2px] pl-[38px] text-[10px] text-muted">
                  {Array.from({ length: 24 }, (_, hour) => (
                    <span key={hour} className="flex-1 text-center">
                      {hour % 6 === 0 ? hour : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-2xl border border-edge/80 bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold">
                Son 30 günün sanatçıları
              </h2>
              <ol className="flex flex-col gap-2">
                {stats.artists.map(([artist, count], i) => (
                  <li key={artist} className="flex items-baseline gap-2 text-sm">
                    <span className="w-4 shrink-0 text-xs text-muted">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{artist}</span>
                    <span className="shrink-0 text-xs text-muted">{count}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-2xl border border-edge/80 bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold">
                Son 30 günün şarkıları
              </h2>
              <ol className="flex flex-col gap-2">
                {stats.tracks.map(([track, count], i) => (
                  <li key={track} className="flex items-baseline gap-2 text-sm">
                    <span className="w-4 shrink-0 text-xs text-muted">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{track}</span>
                    <span className="shrink-0 text-xs text-muted">{count}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {flashback.length > 0 && (
            <section className="rounded-2xl border border-edge/80 bg-card p-5">
              <h2 className="mb-1 text-sm font-semibold">Geçen sene bugün</h2>
              <p className="mb-3 text-xs text-muted">
                {stamp.format(new Date(flashback[0].played_at))}
              </p>
              <ul className="flex flex-col gap-2">
                {flashback.slice(0, 8).map((play) => (
                  <li
                    key={play.played_at}
                    className="flex items-baseline gap-2 text-sm"
                  >
                    <span className="w-10 shrink-0 text-xs text-muted">
                      {timeOnly.format(new Date(play.played_at))}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {play.track} — {play.artist}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {stats.since && (
            <p className="text-center text-xs text-muted">
              Arşivin bu penceredeki en eski kaydı:{' '}
              {stamp.format(new Date(stats.since))}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
