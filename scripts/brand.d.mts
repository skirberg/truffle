// Types for scripts/brand.mjs, read by tests/brand.test.ts.
export const KIT: string
export const SERVED: Record<string, string>
export const SHARE_CARDS: string[]
export type KitFile = { path: string; bytes: number; sha256: string; width?: number; height?: number; sizes?: number[] }
export type KitManifest = { name: string; site: string; page: string; version: { sha: string; date: string }; served: Record<string, string>; shareCards: string[]; files: KitFile[] }
export function build(opts?: { bundle?: boolean }): Promise<{ files: Map<string, Buffer>; manifest?: KitManifest }>
export const MIZNER_PLAZA: string
