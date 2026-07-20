import type { ReactNode } from 'react'

type CardProps = {
  title: string
  icon?: string
  meta?: string
  loading?: boolean
  error?: string | null
  action?: ReactNode
  children: ReactNode
}

export function Card({
  title,
  icon,
  meta,
  loading,
  error,
  action,
  children,
}: CardProps) {
  return (
    <section className="flex flex-col rounded-2xl border border-edge/80 bg-card p-6 shadow-[0_1px_2px_rgba(16,24,40,0.03),0_8px_24px_-12px_rgba(16,24,40,0.10)] transition-shadow sm:p-7 hover:shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-12px_rgba(16,24,40,0.14)]">
      <header className="mb-5 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2.5">
          {icon && (
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-panel text-sm"
            >
              {icon}
            </span>
          )}
          <span className="truncate text-sm font-semibold">{title}</span>
        </h2>

        <span className="shrink-0">
          {action ?? (meta && <span className="text-xs text-muted">{meta}</span>)}
        </span>
      </header>

      {loading ? (
        <div className="space-y-2.5" aria-live="polite">
          <div className="h-3.5 w-2/3 animate-pulse rounded-full bg-panel" />
          <div className="h-3.5 w-1/2 animate-pulse rounded-full bg-panel" />
        </div>
      ) : error ? (
        <p className="text-sm text-down">{error}</p>
      ) : (
        children
      )}
    </section>
  )
}
