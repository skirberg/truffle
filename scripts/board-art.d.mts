// Types for scripts/board-art.mjs, read by the share card of a lot under fog (lib/fog-art.ts).
export type BoardLot = { id: string; h: number; u: string; z: string; c: number; rings: [number, number][][] }
export type Style = { h: number; colors: string[]; base?: number; fit?: boolean } | null
export const USE: Record<string, [string, string, string]>
export function readLots(file?: string): Promise<BoardLot[]>
export function readLotsNear(file: string, center: [number, number], radius: number, zoom?: number): Promise<BoardLot[]>
export function middle(lot: BoardLot): [number, number]
export function draw(
  lots: BoardLot[],
  opts: {
    center: [number, number]
    radius: number
    pitch: number
    bearing: number
    crop: { scale: number; at: [number, number]; size: [number, number] } | { fit: [number, number, number, number] }
    style: (lot: BoardLot) => Style
    mark?: { id: string; h: number; px?: number; line?: number } | null
    background?: string | null
  },
): { svg: string; inner: string; viewBox: string; width: number; height: number }
