import { useState } from 'react'
import { CARDS, reconcile, type CardId, type CardPrefs } from '../lib/cards'

type Props = {
  prefs: CardPrefs
  onChange: (next: CardPrefs) => void
  onClose: () => void
}

/**
 * Kartların sırasını ve görünürlüğünü düzenler.
 *
 * Sürükleme kartların kendisi yerine bu listede yapılıyor: panelde sürüklenen
 * kartın bırakılacağı yeri hesaplamak hem kırılgan hem de dokunmatikte zor.
 * Kompakt liste her iki durumda da güvenilir çalışıyor.
 */
export function CardSettings({ prefs, onChange, onClose }: Props) {
  const [dragging, setDragging] = useState<CardId | null>(null)

  const label = (id: CardId) => CARDS.find((c) => c.id === id)?.label ?? id

  function move(from: CardId, to: CardId) {
    if (from === to) return

    const order = [...prefs.order]
    const fromIndex = order.indexOf(from)
    const toIndex = order.indexOf(to)
    order.splice(fromIndex, 1)
    order.splice(toIndex, 0, from)
    onChange({ ...prefs, order })
  }

  function toggle(id: CardId) {
    const hidden = prefs.hidden.includes(id)
      ? prefs.hidden.filter((h) => h !== id)
      : [...prefs.hidden, id]
    onChange({ ...prefs, hidden })
  }

  return (
    <div className="mb-5 rounded-2xl border border-edge/80 bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03),0_8px_24px_-12px_rgba(16,24,40,0.10)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Kartları düzenle</p>
          <p className="mt-0.5 text-xs text-muted">
            Sürükleyerek sırala, göz simgesiyle gizle.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Kayıtlı tercih varsayılanı ezdiği için, önerilen sıra
              değiştiğinde kullanıcı onu ancak buradan görebiliyor. */}
          <button
            onClick={() => onChange(reconcile(null))}
            title="Önerilen sıraya döner ve gizli kartları geri getirir"
            className="h-9 rounded-xl px-3 text-sm font-medium text-muted transition-colors hover:bg-panel hover:text-ink"
          >
            Varsayılana dön
          </button>
          <button
            onClick={onClose}
            className="h-9 rounded-xl border border-edge/80 px-3 text-sm font-medium transition-colors hover:bg-panel"
          >
            Bitti
          </button>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5">
        {prefs.order.map((id) => {
          const hidden = prefs.hidden.includes(id)
          return (
            <li
              key={id}
              draggable
              onDragStart={() => setDragging(id)}
              onDragEnd={() => setDragging(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragging && move(dragging, id)}
              className={`flex cursor-grab items-center gap-2 rounded-lg border border-edge bg-panel/50 px-3 py-2 text-sm active:cursor-grabbing ${
                dragging === id ? 'opacity-40' : ''
              }`}
            >
              <span className="text-muted" aria-hidden>
                ⠿
              </span>
              <span className={`flex-1 ${hidden ? 'text-muted line-through' : ''}`}>
                {label(id)}
              </span>
              <button
                onClick={() => toggle(id)}
                aria-label={hidden ? 'Kartı göster' : 'Kartı gizle'}
                title={hidden ? 'Göster' : 'Gizle'}
                className="rounded-md px-1.5 py-0.5 text-muted hover:bg-card hover:text-ink"
              >
                {hidden ? '🙈' : '👁'}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
