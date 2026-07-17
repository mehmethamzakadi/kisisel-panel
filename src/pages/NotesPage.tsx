import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BackIcon } from '../components/icons'

type Note = {
  id: number
  body: string
  created_at: string
  pinned: boolean
  remind_on: string | null
}

const SELECT = 'id, body, created_at, pinned, remind_on'

const stamp = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

const dateOnly = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
})

/** Yerel saate göre YYYY-MM-DD (toISOString UTC'ye kaydırıp günü kaydırır). */
function today() {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function sortNotes(list: Note[]) {
  return [...list].sort((a, b) =>
    a.pinned === b.pinned
      ? b.created_at.localeCompare(a.created_at)
      : a.pinned
        ? -1
        : 1,
  )
}

export function NotesPage() {
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [summarizing, setSummarizing] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setError('Supabase yapılandırılmadı.')
      return
    }

    let cancelled = false

    supabase
      .from('notes')
      .select(SELECT)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setNotes(data)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const shown = useMemo(() => {
    if (!notes) return null
    const q = query.trim().toLocaleLowerCase('tr')
    if (!q) return notes
    return notes.filter((n) => n.body.toLocaleLowerCase('tr').includes(q))
  }, [notes, query])

  async function addNote(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || !supabase) return

    setSaving(true)
    const { data, error } = await supabase
      .from('notes')
      .insert({ body })
      .select(SELECT)
      .single()
    setSaving(false)

    if (error) return setError(error.message)

    setNotes((prev) => sortNotes([data, ...(prev ?? [])]))
    setDraft('')
  }

  async function patch(id: number, patch: Partial<Note>, resort = false) {
    if (!supabase) return

    const previous = notes
    setNotes((prev) => {
      const next = prev?.map((n) => (n.id === id ? { ...n, ...patch } : n)) ?? null
      return next && resort ? sortNotes(next) : next
    })

    const { error } = await supabase.from('notes').update(patch).eq('id', id)
    if (error) {
      setError(error.message)
      setNotes(previous)
    }
  }

  async function removeNote(id: number) {
    if (!supabase) return

    const previous = notes
    setNotes((prev) => prev?.filter((n) => n.id !== id) ?? null)

    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (error) {
      setError(error.message)
      setNotes(previous)
    }
  }

  /** Notu Gemini ile maddelere böler ve yerine yazar. */
  async function bulletize(note: Note) {
    if (!supabase) return

    setBusy(note.id)
    const { data, error } = await supabase.functions.invoke('note-assist', {
      body: { action: 'bulletize', texts: [note.body] },
    })
    setBusy(null)

    if (error || !data?.result) {
      setError('Not maddelere bölünemedi. Tekrar deneyin.')
      return
    }

    await patch(note.id, { body: data.result })
  }

  async function summarize() {
    if (!supabase || !notes?.length) return

    setSummarizing(true)
    setSummary(null)
    const { data, error } = await supabase.functions.invoke('note-assist', {
      body: { action: 'summarize', texts: notes.slice(0, 40).map((n) => n.body) },
    })
    setSummarizing(false)

    if (error || !data?.result) {
      setError('Özet alınamadı. Tekrar deneyin.')
      return
    }

    setSummary(data.result)
  }

  const t = today()

  return (
    <div className="mx-auto min-h-dvh w-full max-w-3xl p-4 sm:p-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            aria-label="Panele dön"
            className="flex size-9 items-center justify-center rounded-xl border border-edge/80 bg-card text-muted transition-colors hover:text-ink"
          >
            <BackIcon />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Notlar</h1>
            <p className="mt-0.5 text-sm text-muted">
              {notes ? `${notes.length} not` : 'Yükleniyor…'}
            </p>
          </div>
        </div>

        {!!notes?.length && (
          <button
            onClick={() => void summarize()}
            disabled={summarizing}
            className="flex h-9 items-center gap-2 rounded-xl border border-edge/80 bg-card px-3 text-sm font-medium transition-colors hover:bg-panel disabled:opacity-50"
          >
            ✨ {summarizing ? 'Özetleniyor…' : 'Özetle'}
          </button>
        )}
      </header>

      {summary && (
        <div className="mb-4 rounded-xl border border-accent/30 bg-accent-soft p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-accent uppercase">
              Notlarının özeti
            </p>
            <button
              onClick={() => setSummary(null)}
              aria-label="Özeti kapat"
              className="text-muted hover:text-ink"
            >
              ✕
            </button>
          </div>
          <p className="text-sm whitespace-pre-wrap">{summary}</p>
        </div>
      )}

      <form onSubmit={addNote} className="mb-4 flex gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl+Enter ile kaydet — uzun not yazarken satır atlamak mümkün kalsın.
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              void addNote(e)
            }
          }}
          rows={2}
          placeholder="Yeni not… (Ctrl+Enter ile kaydet)"
          className="min-w-0 flex-1 resize-y rounded-xl border border-edge bg-card px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={saving || !draft.trim()}
          className="h-fit rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Ekle
        </button>
      </form>

      {notes && notes.length > 3 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Notlarda ara…"
          className="mb-4 w-full rounded-xl border border-edge bg-card px-3 py-2 text-sm outline-none focus:border-accent"
        />
      )}

      {error && <p className="mb-3 text-sm text-down">{error}</p>}

      {shown?.length === 0 && (
        <p className="rounded-xl border border-dashed border-edge py-10 text-center text-sm text-muted">
          {query ? 'Eşleşen not yok.' : 'Henüz not eklemedin.'}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {shown?.map((note) => (
          <li
            key={note.id}
            className="rounded-xl border border-edge bg-card p-3.5 shadow-sm"
          >
            {editing === note.id ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  rows={4}
                  autoFocus
                  className="w-full resize-y rounded-lg border border-edge bg-panel/60 px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const body = editDraft.trim()
                      if (body) void patch(note.id, { body })
                      setEditing(null)
                    }}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Kaydet
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="rounded-lg border border-edge px-3 py-1.5 text-xs"
                  >
                    Vazgeç
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{stamp.format(new Date(note.created_at))}</span>
                      {note.remind_on && (
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium ${
                            note.remind_on <= t
                              ? 'bg-accent-soft text-accent'
                              : 'bg-panel'
                          }`}
                        >
                          ⏰ {dateOnly.format(new Date(note.remind_on))}
                          {note.remind_on <= t && ' • bugün'}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1 text-xs">
                    <button
                      onClick={() => void bulletize(note)}
                      disabled={busy === note.id}
                      aria-label="Maddelere böl"
                      title="Gemini ile maddelere böl"
                      className="rounded-md px-1.5 py-1 text-muted hover:bg-panel hover:text-accent disabled:opacity-40"
                    >
                      {busy === note.id ? '…' : '✨'}
                    </button>
                    <button
                      onClick={() => void patch(note.id, { pinned: !note.pinned }, true)}
                      aria-label={note.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
                      title={note.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
                      className={`rounded-md px-1.5 py-1 hover:bg-panel ${
                        note.pinned ? 'text-accent' : 'text-muted'
                      }`}
                    >
                      {note.pinned ? '★' : '☆'}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(note.id)
                        setEditDraft(note.body)
                      }}
                      aria-label="Düzenle"
                      title="Düzenle"
                      className="rounded-md px-1.5 py-1 text-muted hover:bg-panel"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => void removeNote(note.id)}
                      aria-label="Sil"
                      title="Sil"
                      className="rounded-md px-1.5 py-1 text-muted hover:bg-panel hover:text-down"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                  Hatırlat
                  <input
                    type="date"
                    value={note.remind_on ?? ''}
                    onChange={(e) =>
                      void patch(note.id, { remind_on: e.target.value || null })
                    }
                    className="rounded-md border border-edge bg-card px-2 py-1 text-ink"
                  />
                  {note.remind_on && (
                    <button
                      onClick={() => void patch(note.id, { remind_on: null })}
                      className="hover:text-down"
                    >
                      kaldır
                    </button>
                  )}
                </label>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
