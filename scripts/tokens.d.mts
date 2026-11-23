// Types for scripts/tokens.mjs, read by tests/tokens.test.ts.
import type tokensJson from '../brand/tokens.json'
export const tokens: typeof tokensJson
export const COLOR_ROWS: [name: string, token: string, hex: string, role: string][]
export function resolve(v: unknown): unknown
export function oklch(hex: string): [number, number, number]
export function hexOf(lch: [number, number, number]): string
export function css(): string
export function dtcg(): Record<string, unknown>
export function dtcgText(): string
