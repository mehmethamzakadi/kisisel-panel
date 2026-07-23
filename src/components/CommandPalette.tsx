import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { onOpenPalette } from '../lib/bus'
import { buildCommands, matchCommands } from '../lib/commands'
import type { Match } from '../lib/commands'

/**
 * Cmd/Ctrl+K ile açılan komut paleti.
 *
 * Kişisel panelde iş genelde tek bir eylem: bir şey ekle, bir liste çal, sayacı
 * başlat. Bunun için doğru kartı gözle arayıp fareyle tıklamak yavaş; palet
 * aynı eylemleri iki tuş uzağa getiriyor. Komutlar mevcut lib fonksiyonlarını
 * çağırıyor, yeni iş mantığı yok (bkz. lib/commands.ts).
 */
export function CommandPalette() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [active, setActive] = useState(0)
  const [running, setRunning] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // navigate her render'da yeni referans olabiliyor; komut listesi sabit kalsın.
  const commands = useMemo(() => buildCommands(navigate), [navigate])
  const matches = useMemo(
    () => matchCommands(commands, input),
    [commands, input],
  )

  const close = useCallback(() => {
    setOpen(false)
    setInput('')
    setActive(0)
    setNotice(null)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // TopBar'daki gösterge düğmesi. Kısayol ile aynı paleti açıyor.
  useEffect(() => onOpenPalette(() => setOpen(true)), [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Girdi değişince seçim başa dönsün; yoksa kısalan listede imleç boşluğa
  // düşüyor ve Enter yanlış komutu çalıştırıyordu.
  useEffect(() => setActive(0), [input])

  const run = useCallback(
    async (match: Match) => {
      setRunning(true)
      let message: string | null = null

      try {
        message = await match.command.run(match.argument)
      } catch (error) {
        message = error instanceof Error ? error.message : 'Komut başarısız oldu.'
      }

      setRunning(false)

      // Sonucu olmayan komutlar (gezinme) hemen kapanır; sonucu olanlar
      // mesajı gösterip kendiliğinden kapanır, ayrı bir bildirim katmanı
      // kurmaya değmeyecek kadar kısa bir geri bildirim.
      if (!message) {
        close()
        return
      }

      setNotice(message)
      setTimeout(close, 2200)
    },
    [close],
  )

  if (!open) return null

  const current = matches[active]

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Komut paleti"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-edge bg-card shadow-2xl"
      >
        <input
          ref={inputRef}
          value={input}
          disabled={running || notice !== null}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              close()
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((i) => (matches.length ? (i + 1) % matches.length : 0))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) =>
                matches.length ? (i - 1 + matches.length) % matches.length : 0,
              )
            } else if (e.key === 'Enter' && current) {
              e.preventDefault()
              void run(current)
            }
          }}
          placeholder="Komut ara ya da 'ekle süt' yaz"
          className="w-full border-b border-edge bg-transparent px-5 py-4 text-sm outline-none placeholder:text-muted"
        />

        {notice ? (
          <p className="px-5 py-4 text-sm text-accent">{notice}</p>
        ) : matches.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">Eşleşen komut yok.</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1.5">
            {matches.map((match, i) => (
              <li key={match.command.id}>
                <button
                  onClick={() => void run(match)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left text-sm ${
                    i === active ? 'bg-accent-soft text-accent' : 'hover:bg-panel'
                  }`}
                >
                  <span className="truncate">
                    {match.command.label}
                    {match.argument && (
                      <span className="font-semibold"> — {match.argument}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {match.command.prefix && !match.argument
                      ? `${match.command.prefix} <${match.command.argumentHint}>`
                      : match.command.group}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
