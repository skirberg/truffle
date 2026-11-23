// A tile set too big for one cacheable file ships as pieces, cut by the pipeline that writes the tiles: one
// piece for the zooms that show the state or a county, one per square of the state for street zooms, and a
// small index. This reads the pieces as one source: shards://<name>/{z}/{x}/{y}.
import { PMTiles } from 'pmtiles'
import type { AddProtocolAction } from 'maplibre-gl'

export type ShardIndex = {
  stem: string
  overview: number
  zoom: number
  minzoom: number
  maxzoom: number
  bounds: [number, number, number, number]
  shards: string[]
}

const sets = new Map<string, { index: ShardIndex; base: string; have: Set<string>; files: Map<string, PMTiles> }>()

export function isShardIndex(url: string): boolean {
  return /\.json(\?|$)/.test(url)
}

export async function registerShards(name: string, url: string): Promise<ShardIndex> {
  const index = (await (await fetch(url)).json()) as ShardIndex
  sets.set(name, { index, base: url.slice(0, url.lastIndexOf('/') + 1), have: new Set(index.shards), files: new Map() })
  return index
}

function pieceOf(index: Pick<ShardIndex, 'overview' | 'zoom'>, z: number, x: number, y: number): string {
  if (z <= index.overview) return '0'
  const s = 2 ** (z - index.zoom)
  return `${Math.floor(x / s)}-${Math.floor(y / s)}`
}

export const shardProtocol: AddProtocolAction = async (params, abort) => {
  const m = /^shards:\/\/([^/]+)\/(\d+)\/(\d+)\/(\d+)/.exec(params.url)
  const set = m && sets.get(m[1]!)
  if (!m || !set) throw new Error(`no tiles for ${params.url}`)
  const [z, x, y] = [Number(m[2]), Number(m[3]), Number(m[4])]
  const key = pieceOf(set.index, z, x, y)
  if (!set.have.has(key)) return { data: new Uint8Array() }
  let file = set.files.get(key)
  if (!file) {
    file = new PMTiles(`${set.base}${set.index.stem}-${key}.pmtiles`)
    set.files.set(key, file)
  }
  const tile = await file.getZxy(z, x, y, abort.signal)
  return { data: tile ? new Uint8Array(tile.data) : new Uint8Array() }
}
