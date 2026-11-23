// What /built shows that isn't read from the records: the lot it follows, and the checks it names.

/** Mizner Plaza, a block of shops downtown: /built follows it from the county's record to its tile, and its
 * share card stands it in truffle brown where the outlines turn into tiles (scripts/brand.mjs, the same id). */
export const TRACE_LOT = '06434720280000070'

/** The widths `npm run qa` opens every page at (e2e/qa.spec.ts), and the height it gives each. */
export const QA_WIDTHS = [320, 375, 768, 1024, 1440] as const
export const qaHeight = (w: number) => (w < 768 ? 812 : 900)
