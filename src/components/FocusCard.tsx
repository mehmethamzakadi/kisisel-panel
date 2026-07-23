import { useCallback, useEffect, useRef, useState } from 'react'
import { Card } from './Card'
import { supabase } from '../lib/supabase'
import { focusChanged, onFocusRequest, takeFocusRequest } from '../lib/bus'
import {
  failureMessage,
  pause,
  play,
  presetQuery,
  savedDevice,
} from '../lib/playback'

const LENGTHS = [15, 25, 50]

// Seans sekme kapansa da sürsün: süre değil, bitiş anı saklanır.
const KEY = 'panel:focus'

// Geçmiş bu pencere için okunuyor: günlük çubuklar 7 gün, "bu ay" toplamı 30.
const HISTORY_DAYS = 30

type Session = { until: number; startedAt: number; planned: number }

type FocusRow = { ended_at: string; minutes: number; completed: boolean }

const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return typeof parsed?.until === 'number' ? (parsed as Session) : null
  } catch {
    return null
  }
}

function clock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** 90 → "1 sa 30 dk", 45 → "45 dk". Ham dakika büyük sayılarda okunmuyor. */
function humanize(minutes: number) {
  if (minutes < 60) return `${minutes} dk`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} sa ${rest} dk` : `${hours} sa`
}

/** Yerel gün anahtarı; toISOString UTC'ye kaydırıp günü kaydırırdı. */
function dayKey(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Odak seansı: süre boyunca odak listesi çalar, bitince müziği durdurur ve
 * seansı kaydeder. Müzik başlatılamasa bile sayaç çalışır — zamanlayıcı tek
 * başına da işe yarar.
 */
export function FocusCard() {
  const [session, setSession] = useState<Session | null>(readSession)
  const [remaining, setRemaining] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [history, setHistory] = useState<FocusRow[] | null>(null)

  // Bitiş bir kez işlensin: interval her saniye tetikleniyor.
  const finished = useRef(false)

  const loadHistory = useCallback(async () => {
    if (!supabase) {
      setHistory([])
      return
    }

    const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString()
    const { data } = await supabase
      .from('focus_sessions')
      .select('ended_at, minutes, completed')
      .gte('ended_at', since)
      .order('ended_at', { ascending: false })

    setHistory((data as FocusRow[]) ?? [])
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  // Seansı panele duyur: müzik kartı seansı tanısın, dikkat dağıtan kartlar
  // sessizleşsin. Yayın seansı state'e bağlanarak yapılıyor çünkü seans üç
  // ayrı yoldan değişiyor — başlatma, bitirme ve sekme kapalıyken dolmuş
  // seansın temizlenmesi. Üçüne ayrı ayrı çağrı koymak birini unutmak demekti.
  useEffect(() => {
    focusChanged(
      session ? { until: session.until, planned: session.planned } : null,
    )
  }, [session])

  /** Seansı kapatır. keep=false ise vazgeçme sayılır ve kaydedilmez. */
  const stop = useCallback(
    async (keep: boolean, silent: boolean) => {
      if (finished.current) return
      finished.current = true

      const current = session ?? readSession()
      localStorage.removeItem(KEY)
      setSession(null)
      setNotice(null)

      if (keep && current && supabase) {
        // Hedeflenen değil, gerçekten geçen süre kaydedilir.
        const elapsed = Math.round((Date.now() - current.startedAt) / 60_000)
        const minutes = Math.min(current.planned, Math.max(1, elapsed))

        await supabase.from('focus_sessions').insert({
          started_at: new Date(current.startedAt).toISOString(),
          minutes,
          planned_minutes: current.planned,
          completed: minutes >= current.planned,
        })

        void loadHistory()
      }

      if (silent) return

      await pause()
      setNotice('Seans bitti. Müzik durduruldu.')

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Odak seansı bitti', { body: 'Müzik durduruldu.' })
      }
    },
    [session, loadHistory],
  )

  useEffect(() => {
    if (!session) return

    finished.current = false

    function tick() {
      const left = session!.until - Date.now()
      setRemaining(left)
      if (left <= 0) void stop(true, false)
    }

    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [session, stop])

  // Sekme kapalıyken dolmuş seans sessizce temizlenir: müziği çok sonradan
  // durdurmak kullanıcıyı şaşırtır. Süre yine de kaydedilir, yaşandı çünkü.
  useEffect(() => {
    const stale = readSession()
    if (stale && stale.until <= Date.now()) {
      localStorage.removeItem(KEY)
      setSession(null)

      if (supabase) {
        void supabase
          .from('focus_sessions')
          .insert({
            started_at: new Date(stale.startedAt).toISOString(),
            ended_at: new Date(stale.until).toISOString(),
            minutes: stale.planned,
            planned_minutes: stale.planned,
            completed: true,
          })
          .then(() => void loadHistory())
      }
    }
  }, [loadHistory])

  const begin = useCallback(async (minutes: number) => {
    setStarting(true)
    setNotice(null)

    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }

    const next: Session = {
      until: Date.now() + minutes * 60_000,
      startedAt: Date.now(),
      planned: minutes,
    }

    localStorage.setItem(KEY, JSON.stringify(next))
    finished.current = false
    setSession(next)

    const result = await play(presetQuery('focus'), savedDevice()?.id)
    setStarting(false)

    if (result.ok) setNotice(`Çalıyor: ${result.playlist.name}`)
    else if (result.reason === 'no-device') setNotice('Sayaç başladı, müzik için açık cihaz yok.')
    else setNotice(`Sayaç başladı. ${failureMessage(result)}`)
  }, [])

  // Komut paletinden gelen "odak başlat" isteği. Mount sırasında bekleyen istek
  // de alınıyor: kullanıcı komutu başka sayfadayken vermiş ve panele yeni
  // dönmüş olabilir. Süren seansın üstüne yazılmıyor.
  useEffect(() => {
    const pending = takeFocusRequest()
    if (pending && !readSession()) void begin(pending)

    return onFocusRequest((minutes) => {
      takeFocusRequest()
      if (!readSession()) void begin(minutes)
    })
  }, [begin])

  // Son yedi günün günlük toplamı — çubuk grafiğin verisi.
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() - (6 - i) * 86_400_000)
    const key = dayKey(date)
    const minutes = (history ?? [])
      .filter((row) => dayKey(new Date(row.ended_at)) === key)
      .reduce((sum, row) => sum + row.minutes, 0)

    return { key, minutes, label: DAY_LABELS[(date.getDay() + 6) % 7] }
  })

  const todayMinutes = days[6].minutes
  const weekMinutes = days.reduce((sum, d) => sum + d.minutes, 0)
  const monthSessions = history?.length ?? 0
  const busiest = Math.max(...days.map((d) => d.minutes), 1)

  const progress = session
    ? Math.min(1, Math.max(0, 1 - remaining / (session.planned * 60_000)))
    : 0

  return (
    <Card
      title="Odak"
      icon="🎯"
      meta={todayMinutes > 0 ? `bugün ${humanize(todayMinutes)}` : undefined}
    >
      {session ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2">
          <div className="relative">
            {/* Halka: kalan süreyi metinle birlikte oran olarak da gösterir. */}
            <svg viewBox="0 0 120 120" className="size-40 -rotate-90">
              <circle
                cx="60"
                cy="60"
                r={RADIUS}
                fill="none"
                strokeWidth="8"
                className="stroke-panel"
              />
              <circle
                cx="60"
                cy="60"
                r={RADIUS}
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
                className="stroke-accent transition-[stroke-dashoffset] duration-1000 ease-linear"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold tabular-nums">
                {clock(remaining)}
              </span>
              <span className="mt-0.5 text-xs text-muted">
                {session.planned} dk seans
              </span>
            </div>
          </div>

          {notice && (
            <p className="max-w-full truncate text-xs text-muted">{notice}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => void stop(true, false)}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white"
            >
              Bitir ve kaydet
            </button>
            <button
              onClick={() => void stop(false, true)}
              className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-ink"
            >
              Vazgeç
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex gap-2">
            {LENGTHS.map((minutes) => (
              <button
                key={minutes}
                onClick={() => void begin(minutes)}
                disabled={starting}
                className="flex-1 rounded-xl border border-edge py-2.5 text-sm font-medium transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent disabled:opacity-40"
              >
                {minutes} dk
              </button>
            ))}
          </div>

          {notice && <p className="text-xs text-muted">{notice}</p>}

          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-panel py-2.5">
              <dt className="text-xs text-muted">Bugün</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                {humanize(todayMinutes)}
              </dd>
            </div>
            <div className="rounded-lg bg-panel py-2.5">
              <dt className="text-xs text-muted">Bu hafta</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                {humanize(weekMinutes)}
              </dd>
            </div>
            <div className="rounded-lg bg-panel py-2.5">
              <dt className="text-xs text-muted">30 gün</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                {monthSessions} seans
              </dd>
            </div>
          </dl>

          <div className="mt-auto">
            <div className="flex h-16 items-end gap-1.5">
              {days.map((day) => (
                <div
                  key={day.key}
                  title={`${day.label}: ${humanize(day.minutes)}`}
                  className="flex flex-1 flex-col justify-end"
                >
                  <div
                    className={`w-full rounded-t-sm ${
                      day.minutes ? 'bg-accent' : 'bg-panel'
                    }`}
                    // Boş günler de ince bir çizgiyle görünsün; tamamen
                    // kaybolurlarsa haftanın ritmi okunmuyor.
                    style={{
                      height: day.minutes
                        ? `${Math.max(8, (day.minutes / busiest) * 100)}%`
                        : '3px',
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="mt-1.5 flex gap-1.5">
              {days.map((day) => (
                <span
                  key={day.key}
                  className="flex-1 text-center text-[10px] text-muted"
                >
                  {day.label}
                </span>
              ))}
            </div>
          </div>

          {history?.length === 0 && (
            <p className="text-xs text-muted">
              Henüz kayıtlı seans yok. İlk seansını başlat.
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
