import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CardsIcon, LogoutIcon, MealIcon, NoteIcon } from './icons'

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

function greeting() {
  const hour = new Date().getHours()
  if (hour < 6) return 'İyi geceler'
  if (hour < 12) return 'Günaydın'
  if (hour < 18) return 'İyi günler'
  return 'İyi akşamlar'
}

const pill =
  'flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium text-muted transition-colors hover:bg-card hover:text-ink'

type Props = {
  email?: string
  demo?: boolean
  editing: boolean
  onToggleEditing: () => void
}

export function TopBar({ email, demo, editing, onToggleEditing }: Props) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{greeting()}</h1>
        <p className="mt-0.5 text-sm text-muted capitalize">
          {dateFormat.format(new Date())}
        </p>
      </div>

      {demo ? (
        <span className="rounded-full border border-edge bg-card px-3 py-1 text-xs text-muted">
          Supabase yapılandırılmadı — giriş kapalı
        </span>
      ) : (
        // Tek bir kapsayıcı: dağınık butonlar yerine gruplanmış bir çubuk.
        <nav className="flex items-center gap-1 rounded-2xl border border-edge/80 bg-card/60 p-1 shadow-[0_1px_2px_rgba(16,24,40,0.03)] backdrop-blur">
          <Link to="/notlar" className={pill}>
            <NoteIcon />
            <span className="hidden sm:inline">Notlar</span>
          </Link>
          <Link to="/tarifler" className={pill}>
            <MealIcon />
            <span className="hidden sm:inline">Tarifler</span>
          </Link>

          <button
            onClick={onToggleEditing}
            aria-pressed={editing}
            className={`${pill} ${editing ? 'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent' : ''}`}
          >
            <CardsIcon />
            <span className="hidden sm:inline">Kartlar</span>
          </button>

          <span className="mx-1 h-5 w-px bg-edge" aria-hidden />

          <span
            title={email}
            className="flex size-8 items-center justify-center rounded-xl bg-accent-soft text-xs font-semibold text-accent uppercase select-none"
          >
            {email?.[0] ?? '?'}
          </span>

          <button
            onClick={() => supabase?.auth.signOut()}
            aria-label="Çıkış yap"
            title="Çıkış yap"
            className="flex size-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-panel hover:text-down"
          >
            <LogoutIcon />
          </button>
        </nav>
      )}
    </header>
  )
}
