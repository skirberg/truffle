// Every sentence the panel, the lot page and the share image say about a lot. One place, one voice.
import { familyOf } from './tokens'
import { day, km, landShareWords, money, shareWords } from './numbers'
import type { Lot, Pull } from './types'
import { isStateLot } from './state-lots'

/** "downtown", "in West Boca", "in Delray Beach": where a lot is ranked. */
export function scopePhrase(lot: Pick<Lot, 'area' | 'place'>): string {
  if (lot.area === 'downtown') return 'downtown'
  if (lot.area === 'west-boca') return 'in West Boca'
  if (lot.place.startsWith('Unincorporated')) return `in ${lot.place.replace('Unincorporated', 'unincorporated')}`
  return `in ${lot.place}`
}

// What a lot is, in plain words. OpenStreetMap's kind when a named place sits on it; otherwise the county's
// use, which is written for assessors ("office bldg-non medical 1 to 3 stories").
const KIND_WORDS: Record<string, string> = {
  supermarket: 'A supermarket', restaurant: 'A restaurant', cafe: 'A café', fast_food: 'A fast-food restaurant',
  bar: 'A bar', pub: 'A bar', school: 'A school', kindergarten: 'A preschool', college: 'A college', university: 'A university',
  place_of_worship: 'A place of worship', park: 'A park', golf_course: 'A golf course', playground: 'A playground',
  hospital: 'A hospital', clinic: 'A clinic', doctors: 'A doctor’s office', dentist: 'A dentist', pharmacy: 'A pharmacy',
  bank: 'A bank', fuel: 'A gas station', townhall: 'City hall', library: 'A library', fire_station: 'A fire station',
  police: 'A police station', post_office: 'A post office', marina: 'A marina', hotel: 'A hotel', motel: 'A motel',
  mall: 'A shopping mall', department_store: 'A department store', clothes: 'A clothing store', convenience: 'A convenience store',
  car: 'A car dealer', car_repair: 'An auto shop', hairdresser: 'A hair salon', beauty: 'A beauty salon', gym: 'A gym',
  fitness_centre: 'A gym', sports_centre: 'A sports center', stadium: 'A stadium', theatre: 'A theater', cinema: 'A movie theater',
  museum: 'A museum', parking: 'A parking lot', community_centre: 'A community center', nursing_home: 'A nursing home',
  office: 'Offices', commercial: 'Business land', retail: 'Shops', industrial: 'Industrial land', church: 'A church',
  dry_cleaning: 'A dry cleaner', hookah_lounge: 'A hookah lounge', estate_agent: 'A real estate office', photographer: 'A photo studio',
  advertising_agency: 'An ad agency', car_parts: 'An auto parts store', apartment: 'Apartments', apartments: 'Apartments',
  mobile_phone: 'A phone store', variety_store: 'A variety store', funeral_directors: 'A funeral home', cannabis: 'A cannabis store',
  alcohol: 'A liquor store', psychotherapist: 'A therapist’s office', pet: 'A pet store', storage_rental: 'Self storage',
  stationery: 'A stationery store', electronics: 'An electronics store', furniture: 'A furniture store', company: 'A business',
  doityourself: 'A hardware store', insurance: 'An insurance office',
}
// The county's and the state's use text is written for assessors. Order matters: the first match wins.
const USE_WORDS: [RegExp, string][] = [
  [/vacant commercial/, 'Empty business land'], [/vacant/, 'Empty land'],
  // One county code covers both, so the words do too.
  [/pkg lt \/ mh pk/, 'A parking lot or mobile home park'],
  [/mht|modular|mobile home/, 'Manufactured homes'],
  [/store\/office\/residential/, 'Shops and offices with homes'],
  // Offices before condos: "medic offic- bldg up to 4 stories condo" is a medical office.
  [/medic/, 'Medical offices'], [/office|off bldg/, 'Offices'],
  [/single family/, 'A single-family home'], [/townhouse/, 'A townhouse'], [/condo/, 'Condos'], [/co-?op/, 'Co-op apartments'],
  [/multifamily/, 'Apartments'], [/common area/, 'Shared land in a neighborhood'],
  [/retirement|home for the aged|nursing|boarding|life care/, 'A home for older people'],
  [/shopping center/, 'A shopping center'],
  [/supermarket/, 'A supermarket'], [/department store/, 'A department store'],
  [/restaurant/, 'A restaurant'], [/self storage/, 'Self storage'], [/store/, 'Shops'],
  [/bank|financial/, 'A bank'], [/motel/, 'A motel'], [/hotel/, 'A hotel'], [/auto sales/, 'A car dealer'], [/service station/, 'A gas station'],
  [/golf/, 'A golf course'], [/church|religious/, 'A place of worship'], [/schl|school|coll/, 'A school'],
  [/hospital/, 'A hospital'], [/cemetery/, 'A cemetery'], [/airport|marina/, 'An airport, terminal or marina'],
  [/thtr|theat|aud|clbhs/, 'A theater, hall or clubhouse'], [/cultural/, 'A cultural building'], [/orphng|non-prof/, 'A nonprofit'],
  [/forest/, 'A park or forest'], [/pkg|parking/, 'A parking lot'], [/park|outdr rec|outdoor rec/, 'A park'],
  [/river|lake/, 'Water'], [/leasehold/, 'Public land leased out'], [/districts?$/, 'Land of a public district'],
  [/municipal|city inc/, 'City land'], [/county/, 'County land'], [/federal/, 'Federal land'],
  [/military/, 'Military land'], [/state/, 'State land'],
  [/utility|centrally assessed/, 'Utility or railroad land'], [/wareh/, 'A warehouse'], [/mfg|industr|processing/, 'Industrial'],
  [/timber/, 'Timberland'], [/citrus|orchard|grove/, 'An orchard or grove'], [/equestrian/, 'Horse land'],
  [/crop|farm|grazing|grag|dairy|nursery|poultry|^ag /, 'Farmland'],
  [/acreage/, 'Open acreage'], [/wetland/, 'Wetland'], [/r\/w|right of way|right/, 'Road land'],
]
// When the records use words not on the list, the lot is named by its color on the map, never by raw assessor text.
const USE_GROUP: Record<Lot['use'], string> = { homes: 'Homes', biz: 'A business', civic: 'Civic land', vacant: 'Empty land', other: 'Land with another use' }

/** Assessor's use text in plain words, or null when it isn't on the list. */
export function plainUse(useText: string): string | null {
  const t = useText.toLowerCase()
  for (const [re, words] of USE_WORDS) if (re.test(t)) return words
  return null
}

/** What a lot is, in plain words. Never the assessor's own text. */
export function whatItIs(lot: Pick<Lot, 'kind' | 'use_text'> & { use?: Lot['use'] }): string | null {
  if (lot.kind && KIND_WORDS[lot.kind]) return KIND_WORDS[lot.kind]!
  const plain = plainUse(lot.use_text)
  if (plain) return plain
  // An OpenStreetMap kind we have no words for is still a plain word ("florist"), unlike assessor text.
  if (lot.kind && /^[a-z]+(_[a-z]+)?$/.test(lot.kind)) return sentence(lot.kind.replace(/_/g, ' '))
  if (!lot.use_text) return null
  return USE_GROUP[lot.use ?? 'other']
}

/** "a single-family home", "offices": what a lot is, to end a sentence with. */
export function usedAs(lot: Pick<Lot, 'kind' | 'use_text'> & { use?: Lot['use'] }): string | null {
  const w = whatItIs(lot)
  return w ? w.charAt(0).toLowerCase() + w.slice(1) : null
}

export function lotTitle(lot: Lot): string {
  if (lot.name) return lot.name
  return lot.address ?? whatItIs(lot) ?? 'A lot with no address on record'
}

function sentence(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Up to four reasons, in the prototype's order: land share, walk reach, rank, zoning. */
export function reasons(lot: Lot): string[] {
  const out: string[] = []
  // "House" only for a house: apartments, condos and townhouses count as homes but are buildings.
  const thing = lot.use === 'homes' && /single|house|home/i.test(lot.use_text) && !/townhouse|condo|apartment|aged|nursing|retirement|boarding|multifamily/i.test(lot.use_text) ? 'house' : 'building'
  // "Nearly all", never 100%, beside a building that is worth something.
  const share = landShareWords(lot.land, lot.building)
  if (share !== null) out.push(`The land is ${share} of the value. The ${thing} is worth ${money(lot.building)}.`)
  else if (lot.land > 0 && lot.building === 0) out.push(`The ${thing} is valued at $0. All of the value is the land.`)
  if (lot.km !== null && lot.typical_km !== null)
    out.push(`A 10-minute walk reaches ${km(lot.km)} km of street. The typical lot here reaches ${Math.round(lot.typical_km)}.`)
  if (lot.vpa > 0 && lot.pct !== null) out.push(`Worth more per acre than ${Math.min(99, lot.pct)}% of valued lots ${scopePhrase(lot)}.`)
  const fam = familyOf(lot.zfam)
  out.push(fam && lot.zfam !== 'none' ? `Zoned for ${fam.name.toLowerCase()}.` : 'No zoning in the records.')
  return out.slice(0, 4)
}

/** What the front door knows about each lot around the one called, from the same records. */
export type Neighbor = Pick<Lot, 'vpa' | 'acres' | 'use' | 'land' | 'building'> & { built?: number | null }

const middleOf = (xs: number[]): number | null => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[s.length >> 1]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2
}
/** 2.5, 0.2, 0.18, 0.04, 12: an acreage short enough to read in a sentence. */
function acresWords(a: number): string {
  const n = a >= 10 ? String(Math.round(a)) : a >= 1 ? a.toFixed(1).replace(/\.0$/, '') : a.toFixed(2).replace(/0$/, '')
  return n === '1' ? '1 acre' : `${n} acres`
}
const AROUND: Partial<Record<Lot['use'], string>> = { homes: 'homes', biz: 'shops and offices', civic: 'civic land and parks', vacant: 'empty' }

/** What a reason rests on: a difference in the records ("size", "use", "share", "built"), or none of them. */
export type Ground = 'size' | 'use' | 'share' | 'built' | 'land' | 'none'

/**
 * The front door's answer to its own question: why this lot is worth more or less per acre than the lots
 * around it. It compares the lot with its neighbors on what the records hold (size, use, land share, year
 * built) and says only what they show, two facts at most. Null when there is nothing to compare with.
 */
export function callReason(lot: Lot, neighbors: Neighbor[], median: number | null): string | null {
  return explainCall(lot, neighbors, median)?.text ?? null
}

/** The typical lot around the called one, from the same records: what the answer draws beside the lot. */
export type Typical = {
  /** Middle size of the valued lots around it, in acres. */
  acres: number | null
  /** What most of them are, when most of them (six in ten) are one thing. */
  use: Lot['use'] | null
  /** Middle share of their value that is land, in percent. */
  share: number | null
  /** Middle year built, where five or more carry one. */
  built: number | null
  /** Middle land value, in dollars. */
  land: number | null
}

/** The middle of the valued lots around a lot, the way the reason reads them. */
export function typicalOf(neighbors: Neighbor[]): Typical {
  const near = neighbors.filter((n) => n.vpa > 0)
  const by = new Map<Lot['use'], number>()
  for (const n of near) by.set(n.use, (by.get(n.use) ?? 0) + 1)
  const top = [...by].sort((a, b) => b[1] - a[1])[0]
  const share = (n: Pick<Lot, 'land' | 'building'>) => (n.land > 0 ? (100 * n.land) / (n.land + Math.max(0, n.building)) : null)
  const years = near.map((n) => n.built ?? 0).filter((y) => y > 0)
  return {
    acres: middleOf(near.filter((n) => n.acres > 0).map((n) => n.acres)),
    use: top && near.length && top[1] / near.length >= 0.6 ? top[0] : null,
    share: middleOf(near.map(share).filter((x): x is number => x !== null)),
    built: years.length >= 5 ? Math.round(middleOf(years)!) : null,
    land: middleOf(near.filter((n) => n.land > 0).map((n) => n.land)),
  }
}

/**
 * The reason in a few words, to sit under the picture of the lot beside the typical one (the picture shows the
 * sizes, the heights and the colors; the words name which of them is the reason). The full sentence stays one
 * tap away.
 */
export function shortWhy(lot: Lot, grounds: Ground[], typical: Typical, less: boolean): string {
  switch (grounds[0]) {
    case 'size':
      return less ? 'Bigger lot, value spread thin.' : 'Smaller lot, value packed tight.'
    case 'use':
      return typical.use && AROUND[typical.use] ? `Mostly ${AROUND[typical.use]} around it.` : 'A different use from its neighbors.'
    case 'share': {
      const mine = lot.land > 0 ? (100 * lot.land) / (lot.land + Math.max(0, lot.building)) : null
      return mine !== null && typical.share !== null ? `Land: ${shareWords(mine)} of it, ${shareWords(typical.share)} around it.` : 'Its land share sets it apart.'
    }
    case 'built':
      return lot.built && typical.built ? `Built ${lot.built}, around it ${typical.built}.` : 'Built at another time.'
    case 'land':
      return typical.land ? `Land at ${money(lot.land)}, around it ${money(typical.land)}.` : 'The county values its land differently.'
    default:
      return 'The records don’t say why.'
  }
}

/**
 * The reason and what it rests on. "land" (the county simply puts more on the ground) and "none" (the records
 * don't say) are honest answers but not explanations, so a lot that can only be answered that way is never
 * picked as the day's lot (tests/daily.test.ts).
 */
export function explainCall(lot: Lot, neighbors: Neighbor[], median: number | null): { text: string; grounds: Ground[]; short: string; typical: Typical } | null {
  const r = reasonOf(lot, neighbors, median)
  if (!r) return null
  const typical = typicalOf(neighbors)
  return { ...r, short: shortWhy(lot, r.grounds, typical, lot.vpa < median!), typical }
}

function reasonOf(lot: Lot, neighbors: Neighbor[], median: number | null): { text: string; grounds: Ground[] } | null {
  const near = neighbors.filter((n) => n.vpa > 0)
  if (near.length < 5 || median === null || !(lot.vpa > 0) || lot.vpa === median) return null
  const less = lot.vpa < median
  const facts: string[] = []
  const grounds: Ground[] = []

  // Size: value per acre is the land's value over its acres, so a much bigger lot spreads it thinner.
  const acres = middleOf(near.filter((n) => n.acres > 0).map((n) => n.acres))
  let sameSize = false
  if (acres && lot.acres > 0) {
    const mine = acresWords(lot.acres), theirs = acresWords(acres)
    const r = lot.acres / acres
    if (mine !== theirs && less && r >= 1.5) facts.push(`It’s a big lot: ${mine}, where the typical lot around it is ${theirs}. Its value is spread over more ground.`)
    else if (mine !== theirs && !less && r <= 1 / 1.5) facts.push(`It’s a small lot: ${mine}, where the typical lot around it is ${theirs}. Its value sits on less ground.`)
    else sameSize = r > 1 / 1.5 && r < 1.5
    if (facts.length) grounds.push('size')
  }

  // Use: what most of the lots around it are, when this one is something else.
  const by = new Map<Lot['use'], number>()
  for (const n of near) by.set(n.use, (by.get(n.use) ?? 0) + 1)
  const [most, count] = [...by].sort((a, b) => b[1] - a[1])[0]!
  const what = whatItIs(lot)
  const sameUse = most === lot.use
  if (!sameUse && count / near.length >= 0.6 && AROUND[most] && what) {
    facts.push(`Most lots around it are ${AROUND[most]}. This one is ${what.charAt(0).toLowerCase() + what.slice(1)}.`)
    grounds.push('use')
  }

  // Land share: how much of the worth is ground, against the lots around it.
  const share = (n: Pick<Lot, 'land' | 'building'>) => (n.land > 0 ? (100 * n.land) / (n.land + Math.max(0, n.building)) : null)
  const mineShare = share(lot)
  const theirShare = middleOf(near.map(share).filter((x): x is number => x !== null))
  if (facts.length < 2 && mineShare !== null && theirShare !== null && Math.abs(mineShare - theirShare) >= 15) {
    facts.push(`${mineShare >= 100 ? 'All of its value is the land' : `The land is ${shareWords(mineShare)} of its value`}. Around it the land is typically ${shareWords(theirShare)}.`)
    grounds.push('share')
  }

  // Year built, where the records carry it.
  const built = middleOf(near.map((n) => n.built ?? 0).filter((y) => y > 0))
  if (facts.length < 2 && lot.built && built && near.filter((n) => n.built).length >= 5 && Math.abs(lot.built - built) >= 15) {
    facts.push(`It was built in ${lot.built}. The typical lot around it was built in ${Math.round(built)}.`)
    grounds.push('built')
  }

  if (facts.length) return { text: facts.slice(0, 2).join(' '), grounds: grounds.slice(0, 2) }
  // A smaller gap in size still counts when it runs the right way and nothing bigger explains it.
  if (acres && lot.acres > 0 && acresWords(lot.acres) !== acresWords(acres) && (less ? lot.acres >= acres * 1.1 : lot.acres <= acres / 1.1))
    return {
      text: `It’s ${less ? 'bigger' : 'smaller'} than the typical lot around it: ${acresWords(lot.acres)} against ${acresWords(acres)}. Its value ${less ? 'is spread over more ground' : 'sits on less ground'}.`,
      grounds: ['size'],
    }
  // Nothing in the records sets it apart: say that, not a guess.
  if (sameSize && sameUse) {
    // Same size, same use: what differs is the value the county puts on the ground itself.
    const land = middleOf(near.filter((n) => n.land > 0).map((n) => n.land))
    if (land && lot.land > 0 && less === lot.land < land && money(lot.land) !== money(land))
      return { text: `It’s about the size of the lots around it and the same kind of use. The county puts its land at ${money(lot.land)}, where theirs is typically ${money(land)}.`, grounds: ['land'] }
    return { text: `It’s about the size of the lots around it and the same kind of use. The records don’t say why it’s worth ${less ? 'less' : 'more'}.`, grounds: ['none'] }
  }
  return { text: `The records don’t say why it’s worth ${less ? 'less' : 'more'} per acre than the lots around it.`, grounds: ['none'] }
}

/** Rules view, one lot: what the zoning allows. */
export function ruleLines(lot: Lot, sharing: number | null): string[] {
  const fam = familyOf(lot.zfam)
  const code = lot.zoning?.replace('(city)', '').trim() ?? null
  const out: string[] = []
  if (fam && lot.zfam !== 'none') {
    out.push(fam.line)
    if (code) {
      const where = lot.area === 'downtown' ? 'downtown' : scopePhrase(lot)
      out.push(
        sharing !== null
          ? `Zone ${code}. ${sharing.toLocaleString('en-US')} other lots ${where} share it.`
          : `Zone ${code}.`,
      )
    }
  }
  out.push(usedToday(lot))
  return out
}

/** "Used today as a single-family home.", in plain words. */
export function usedToday(lot: Pick<Lot, 'kind' | 'use_text' | 'use'>): string {
  const as = usedAs(lot)
  return as ? `Used today as ${as}.` : 'We have no use on record for this lot.'
}

/** Which sources a lot's numbers come from. */
export function sourcesFor(lot: Lot | null, pulls: Pull[]): Pull[] {
  if (lot && isStateLot(lot.id)) return pulls.filter((p) => p.key === 'parcels_florida')
  const keys = new Set(['parcels'])
  if (!lot) keys.add('parcels_florida')
  if (!lot || lot.place === 'Boca Raton') keys.add('zoning_boca')
  if (lot?.place.startsWith('Unincorporated')) keys.add('zoning_county')
  if (!lot || lot.km !== null) keys.add('streets')
  const order = ['parcels', 'parcels_florida', 'zoning_boca', 'zoning_county', 'streets']
  return pulls.filter((p) => keys.has(p.key)).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
}

const ROLE: Record<string, string> = {
  parcels: 'Values',
  parcels_florida: 'Values',
  zoning_boca: 'Zoning',
  zoning_county: 'Zoning',
  streets: 'Walk reach',
}
const SHORT: Record<string, string> = {
  parcels: 'Palm Beach County property records',
  zoning_boca: 'City of Boca Raton',
  zoning_county: 'Palm Beach County',
  streets: 'OpenStreetMap streets',
}

/** "Values: Palm Beach County property records. Zoning: City of Boca Raton. Walk reach: OpenStreetMap streets. Pulled Nov 4, 2026." */
export function sourceLine(pulls: Pull[]): string {
  if (!pulls.length) return ''
  const days = [...new Set(pulls.map((p) => p.pulled))]
  if (days.length === 1) {
    return pulls.map((p) => `${ROLE[p.key] ?? p.name}: ${SHORT[p.key] ?? p.name}.`).join(' ') + ` Pulled ${day(days[0]!)}.`
  }
  return pulls.map((p) => `${ROLE[p.key] ?? p.name}: ${SHORT[p.key] ?? p.name}, pulled ${day(p.pulled)}.`).join(' ')
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** When the sources were pulled, as short as stays true: "Nov 4, 2026", "Nov 2 to 4, 2026", "Oct 30 to Nov 4, 2026". */
export function pulledWhen(pulls: Pick<Pull, 'pulled'>[]): string {
  const days = [...new Set(pulls.map((p) => p.pulled))].sort()
  if (!days.length) return ''
  const parts = (d: string) => d.split('-').map(Number) as [number, number, number]
  const a = parts(days[0]!)
  const b = parts(days.at(-1)!)
  if (days.length === 1) return day(days[0]!)
  if (a[0] !== b[0]) return `${day(days[0]!)} to ${day(days.at(-1)!)}`
  if (a[1] !== b[1]) return `${MON[a[1] - 1]} ${a[2]} to ${MON[b[1] - 1]} ${b[2]}, ${b[0]}`
  return `${MON[a[1] - 1]} ${a[2]} to ${b[2]}, ${b[0]}`
}

export function shareDescription(lot: Lot): string {
  const r = reasons(lot)
  return lot.vpa > 0 ? `${money(lot.vpa)} an acre. ${r.join(' ')}` : r.join(' ')
}
