// The pieces the panel is built from, after Apple's place cards: a title with the place's category under
// it and round buttons at its trailing edge, a row of small tiles for the key facts, and grouped sections
// one tone darker than the card with their rows divided by a fine line. Brand colors and Gabarito, not
// Apple's look: the guidelines ask an app's map UI to match the app, not copy Maps.

export function CardHeader({ title, lines, actions }: { title: string; lines: (string | null | undefined)[]; actions?: React.ReactNode }) {
  const sub = lines.filter(Boolean) as string[]
  return (
    <header className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-ui-title font-extrabold tracking-[-0.02em] max-[759px]:text-ui-title-phone">{title}</h1>
        {sub.map((l) => (
          <p key={l} className="mt-1 text-ui-small font-medium text-soft">
            {l}
          </p>
        ))}
      </div>
      {actions && <div className="flex flex-none gap-2">{actions}</div>}
    </header>
  )
}

export function RoundButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      // 36 px to see, 44 px to tap: the ring past its edge answers too, and nothing moves.
      className="relative grid size-9 place-items-center rounded-full bg-paper text-soft after:absolute after:-inset-1 after:content-[''] transition-[transform,color] duration-(--motion-tap) ease-out hover:text-truffle active:scale-[0.94] active:text-truffle"
    >
      {children}
    </button>
  )
}

export const CloseIcon = () => (
  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M1.5 1.5l10 10M11.5 1.5l-10 10" />
  </svg>
)

export const ShareIcon = () => (
  <svg aria-hidden="true" width="16" height="18" viewBox="0 0 16 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 11.5V1.5M4.5 5 8 1.5 11.5 5M4.5 8H3a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 3 17h10a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 13 8h-1.5" />
  </svg>
)

/** Key facts as small tiles: a label over a number, two to three in a row. */
export function Tiles({ items }: { items: { label: string; value: string }[] }) {
  if (!items.length) return null
  return (
    <dl className="m-0 grid gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((t) => (
        <div key={t.label} className="rounded-md bg-paper px-3 pt-3 pb-3">
          <dt className="text-ui-label font-semibold text-soft">{t.label}</dt>
          <dd className="m-0 mt-1 text-ui-headline font-extrabold leading-none tracking-[-0.01em]">{t.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** A grouped section: a heading in the card's soft ink, then a block one tone darker than the card. */
export function Group({ title, children, testId }: { title?: string; children: React.ReactNode; testId?: string }) {
  return (
    <section>
      {title && <h2 className="mb-2 px-1 text-ui-label font-bold text-soft">{title}</h2>}
      <div className="rounded-md bg-paper" data-testid={testId}>
        {children}
      </div>
    </section>
  )
}

/** Rows inside a group, each divided from the next by a fine line inset from the left. */
export function Rows({ items, testId }: { items: React.ReactNode[]; testId?: string }) {
  return (
    <ul className="m-0 list-none p-0" data-testid={testId}>
      {items.map((it, i) => (
        <li key={i} className="relative px-4 py-3 text-ui-body font-medium">
          {i > 0 && <span aria-hidden="true" className="absolute top-0 right-0 left-4 h-px bg-line" />}
          {it}
        </li>
      ))}
    </ul>
  )
}
