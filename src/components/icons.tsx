type Props = { className?: string }

const base = 'size-4 shrink-0'

/** Tek stil: 1.6 kalınlıkta stroke, yuvarlak uçlar. Emoji yerine bunlar
 *  kullanılıyor — emoji platformdan platforma değişiyor ve arayüzde
 *  kontrolsüz duruyor. */
function Svg({ className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className ?? base}
    >
      {children}
    </svg>
  )
}

export const NoteIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" />
    <path d="M8 9h8M8 13h8M8 17h4" />
  </Svg>
)

export const MealIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M7 3v7M10 3v7M8.5 10v11M8.5 10a3 3 0 0 0 3-3V3" />
    <path d="M17 3c-1.5 2-2 4-2 6s.7 3 2 3 2-1 2-3-.5-4-2-6zM17 12v9" />
  </Svg>
)

export const CardsIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M4 6h7v5H4zM13 6h7v5h-7zM4 13h7v5H4zM13 13h7v5h-7z" />
  </Svg>
)

export const LogoutIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 8l-4 4 4 4M6 12h10" />
  </Svg>
)

export const BackIcon = (p: Props) => (
  <Svg {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
)
