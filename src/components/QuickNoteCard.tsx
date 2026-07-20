import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from './Card'
import { supabase } from '../lib/supabase'
import { fetchNowPlaying, toStamp } from '../lib/spotify'
import type { NoteStamp } from '../lib/spotify'

type Note = {
  id: number
  body: string
  created_at: string
  remind_on: string | null
}

const dayFormat = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
})

/** Yerel saate göre YYYY-MM-DD (toISOString UTC'ye kaydırıp günü kaydırır). */
function today() {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

/** Panelde yalnızca hızlı ekleme + son birkaç not; detay /notlar sayfasında. */
export function QuickNoteCard() {
  const [recent, setRecent] = useState<Note[] | null>(null)
  const [due, setDue] = useState<Note[]>([])
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stamp, setStamp] = useState<NoteStamp | null>(null)
  const asked = useRef(false)

  useEffect(() => {
    if (!supabase) {
      setError('Supabase yapılandırılmadı.')
      return
    }

    let cancelled = false
    const client = supabase

    async function load() {
      // Günü gelmiş hatırlatmalar ayrı çekiliyor; son notların arasında
      // kaybolmasınlar, kartın en üstünde dursunlar.
      const [recentRes, dueRes] = await Promise.all([
        client
          .from('notes')
          .select('id, body, created_at, remind_on')
          .order('created_at', { ascending: false })
          .limit(3),
        client
          .from('notes')
          .select('id, body, created_at, remind_on')
          .not('remind_on', 'is', null)
          .lte('remind_on', today())
          .order('remind_on'),
      ])

      if (cancelled) return

      if (recentRes.error) setError(recentRes.error.message)
      else setRecent(recentRes.data)

      if (!dueRes.error && dueRes.data) setDue(dueRes.data)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  /**
   * Not yazmaya başlanınca o an çalan şarkı sorulur — panel açılışında değil.
   * Böylece her yenilemede Spotify'a gereksiz istek gitmez ve damga yalnızca
   * gerçekten not yazılan anı yakalar.
   */
  function askNowPlaying() {
    if (asked.current || !supabase) return
    asked.current = true

    void fetchNowPlaying().then((state) => {
      if (state.playing) setStamp(toStamp(state.playing))
    })
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || !supabase) return

    setSaving(true)
    const { data, error } = await supabase
      .from('notes')
      .insert({ body, spotify: stamp })
      .select('id, body, created_at, remind_on')
      .single()
    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    setRecent((prev) => [data, ...(prev ?? [])].slice(0, 3))
    setDraft('')
    // Sonraki not için damga yeniden sorulsun; şarkı değişmiş olabilir.
    setStamp(null)
    asked.current = false
  }

  return (
    <Card
      title="Hızlı Not"
      icon="📝"
      loading={!recent && !error}
      error={error}
      action={
        <Link
          to="/notlar"
          className="rounded-lg border border-edge px-2.5 py-1 text-xs font-medium text-muted hover:bg-panel hover:text-ink"
        >
          Tümü
        </Link>
      }
    >
      <div className="flex flex-col gap-3">
        {due.length > 0 && (
          <ul className="flex flex-col gap-1.5 rounded-lg bg-accent-soft p-2.5">
            {due.map((note) => (
              <li key={note.id} className="flex gap-2 text-sm">
                <span aria-hidden>⏰</span>
                <span className="min-w-0 flex-1 truncate">{note.body}</span>
              </li>
            ))}
          </ul>
        )}

        {stamp && (
          <div className="flex items-center gap-2 rounded-lg bg-panel px-2.5 py-1.5 text-xs">
            <span aria-hidden>🎧</span>
            <span className="min-w-0 flex-1 truncate text-muted">
              {stamp.track} — {stamp.artist}
            </span>
            <button
              type="button"
              onClick={() => setStamp(null)}
              aria-label="Şarkı damgasını kaldır"
              className="shrink-0 text-muted hover:text-ink"
            >
              ✕
            </button>
          </div>
        )}

        <form onSubmit={addNote} className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={askNowPlaying}
            placeholder="Aklındakini yaz…"
            className="min-w-0 flex-1 rounded-lg border border-edge bg-panel/60 px-3 py-2 text-sm outline-none focus:border-accent focus:bg-card"
          />
          <button
            type="submit"
            disabled={saving || !draft.trim()}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Ekle
          </button>
        </form>

        {recent?.length === 0 ? (
          <p className="py-1 text-sm text-muted">Henüz not yok.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {recent?.map((note) => (
              <li
                key={note.id}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="truncate">{note.body}</span>
                <span className="shrink-0 text-xs text-muted">
                  {dayFormat.format(new Date(note.created_at))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
