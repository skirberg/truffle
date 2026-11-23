import tokens from '@/brand/tokens.json'

export const T = tokens

export const color = {
  paper: tokens.color.paper,
  card: tokens.color.card,
  truffle: tokens.color.truffle,
  truffleSide: tokens.color.truffleSide,
  soft: tokens.color.soft,
  faint: tokens.color.faint,
  line: tokens.color.line,
  /** Rivers, lakes and the sea. Not a use: quieter than civic blue, so water never reads as a park. */
  water: tokens.color.water,
} as const

export type UseKey = 'homes' | 'biz' | 'civic' | 'vacant' | 'other'
export type ZoningKey = 'single' | 'duplex' | 'apartments' | 'downtown' | 'shops' | 'public' | 'special' | 'none'

/** Side shades from the tokens, for map lines that need to read a step darker than the paper. */
export const tokenColor = { vacantLeft: tokens.color.use.vacant[1]!, vacantRight: tokens.color.use.vacant[2]! }

/** Top color of each use. Sides come from the light, which sits upper left. */
export const useColor: Record<UseKey, string> = {
  homes: tokens.color.use.homes[0]!,
  biz: tokens.color.use.biz[0]!,
  civic: tokens.color.use.civic[0]!,
  vacant: tokens.color.use.vacant[0]!,
  other: tokens.color.use.other[0]!,
}

/** Each use as [top, left side, right side], the way the map's light shades a tile, for tiles drawn in the panel. */
export const useSides = tokens.color.use as Record<UseKey, [string, string, string]>

/** The one-letter codes the tiles carry for use. */
export const useCode: Record<string, UseKey> = { h: 'homes', b: 'biz', c: 'civic', v: 'vacant', o: 'other' }

export const zoningColor = tokens.color.zoning as Record<ZoningKey, string>

export type ZoningFamily = { key: ZoningKey; name: string; line: string }
export const zoningFamilies: ZoningFamily[] = tokens.mappings.zoningFamilies.map((f) => ({
  key: f.key as ZoningKey,
  name: f.name,
  line: f.line,
}))
export const familyOf = (key: string | null | undefined) => zoningFamilies.find((f) => f.key === key) ?? null

const useLabels = tokens.mappings.useLabels as Record<UseKey, string>
export const useLegend: { key: UseKey; label: string }[] = (['homes', 'biz', 'civic', 'vacant'] as const).map((key) => ({
  key,
  label: useLabels[key],
}))

export const map = tokens.map
