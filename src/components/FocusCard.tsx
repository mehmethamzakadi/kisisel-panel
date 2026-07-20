import { useCallback, useEffect, useRef, useState } from 'react'
import { Card } from './Card'
import {
  PRESETS,
  failureMessage,
  pause,
  play,
  savedDevice,
} from '../lib/playback'

const LENGTHS = [25, 50]

// Seans sekme kapansa da sürsün: bitiş anı saklanır, süre değil.
const KEY = 'panel:focus-until'

function readDeadline(): number | null {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null

  const at = Number(raw)
  return Number.isFinite(at) ? at : null
}

function format(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * Odak seansı: süre boyunca odak listesi çalar, bitince müziği durdurur.
 * Müzik başlatılamasa bile sayaç çalışır — zamanlayıcı tek başına da işe yarar.
 */
export function FocusCard() {
  const [deadline, setDeadline] = useState<number | null>(readDeadline)
  const [remaining, setRemaining] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  // Bitiş bir kez işlensin: interval her saniye tetikleniyor.
  const finished = useRef(false)

  const finish = useCallback(async (silent: boolean) => {
    if (finished.current) return
    finished.current = true

    localStorage.removeItem(KEY)
    setDeadline(null)
    // Seans bittiğinde "çalıyor" bilgisi artık geçerli değil.
    setNotice(null)

    if (silent) return

    await pause()
    setNotice('Seans bitti. Müzik durduruldu.')

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Odak seansı bitti', { body: 'Müzik durduruldu.' })
    }
  }, [])

  useEffect(() => {
    if (deadline === null) return

    finished.current = false

    function tick() {
      const left = deadline! - Date.now()
      setRemaining(left)
      if (left <= 0) void finish(false)
    }

    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [deadline, finish])

  // Sekme kapalıyken dolmuş bir seans varsa sessizce temizlenir: müziği
  // çok sonradan durdurmak kullanıcıyı şaşırtır.
  useEffect(() => {
    const at = readDeadline()
    if (at !== null && at <= Date.now()) {
      localStorage.removeItem(KEY)
      setDeadline(null)
    }
  }, [])

  async function begin(minutes: number) {
    setStarting(true)
    setNotice(null)

    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }

    const until = Date.now() + minutes * 60_000
    localStorage.setItem(KEY, String(until))
    finished.current = false
    setDeadline(until)

    const result = await play(PRESETS.focus.query, savedDevice())
    setStarting(false)

    if (result.ok) {
      setNotice(`Çalıyor: ${result.playlist.name}`)
    } else if (result.reason === 'no-device') {
      setNotice('Sayaç başladı ama açık bir Spotify istemcisi yok.')
    } else {
      setNotice(`Sayaç başladı. ${failureMessage(result)}`)
    }
  }

  return (
    <Card title="Odak" icon="🎯">
      {deadline === null ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Süre boyunca odak listesi çalar, bitince müzik durur.
          </p>
          <div className="flex gap-2">
            {LENGTHS.map((minutes) => (
              <button
                key={minutes}
                onClick={() => void begin(minutes)}
                disabled={starting}
                className="rounded-lg border border-edge px-3 py-2 text-sm font-medium hover:bg-panel disabled:opacity-40"
              >
                {minutes} dk
              </button>
            ))}
          </div>
          {notice && <p className="text-xs text-muted">{notice}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-4xl font-semibold tabular-nums">
            {format(remaining)}
          </p>
          {notice && <p className="text-xs text-muted">{notice}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => void finish(false)}
              className="rounded-lg border border-edge px-3 py-1.5 text-xs font-medium hover:bg-panel"
            >
              Bitir ve durdur
            </button>
            <button
              onClick={() => void finish(true)}
              className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-ink"
            >
              Sayacı iptal et
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}
