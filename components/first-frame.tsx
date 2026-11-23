/**
 * The front door's first frame: the lit city, drawn ahead of time from the same tiles at the map's opening
 * camera (scripts/brand.mjs, FIRST_FRAMES), set at 1:1 in the middle of the screen so the map lands on it
 * exactly. It is in the page's HTML, so it paints before any script runs; the map draws under it and it fades
 * out once the lots are there. Before, the first second was empty paper. Decorative, so hidden from readers.
 */
export function FirstFrame({ gone }: { gone: boolean }) {
  return (
    <div
      aria-hidden="true"
      data-testid="first-frame"
      data-gone={gone ? '' : undefined}
      className={`pointer-events-none fixed inset-0 z-[1] overflow-hidden transition-opacity duration-(--motion-fade) ease-out motion-reduce:transition-none ${gone ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* A plain picture: it is drawn for this exact camera and size, so no resizing service may touch it. */}
      <picture>
        <source media="(max-width: 759px)" srcSet="/first-frame-phone.webp" width={480} height={1000} />
        <img
          src="/first-frame-wide.webp"
          alt=""
          width={2560}
          height={1600}
          fetchPriority="high"
          className="absolute top-1/2 left-1/2 h-auto w-[2560px] max-w-none -translate-x-1/2 -translate-y-1/2 max-[759px]:w-[480px]"
        />
      </picture>
    </div>
  )
}
