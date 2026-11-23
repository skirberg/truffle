import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { build, KIT, MIZNER_PLAZA, SERVED } from '../scripts/brand.mjs'
import manifest from '@/app/manifest'
import { linkedFiles } from '@/lib/kit'
import { TRACE_LOT } from '@/lib/built'

// The brand can't drift: every icon the site serves, the art behind every share card and every file in the kit
// is what scripts/brand.mjs draws from the mark's construction, the wordmark, the tokens and the tiles today.
// When this fails, run `npm run brand` and commit what it redraws.
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')
const drawn = build({ bundle: true })

describe('the brand, drawn from one source', () => {
  it('every committed brand file is what the generator draws now', async () => {
    const { files } = await drawn
    const stale: string[] = []
    for (const [path, data] of files) {
      // kit.json, kit.zip and the kit's README name the commit they were drawn from: the build makes them.
      if (/^public\/brand\/(kit\.json|kit\.zip|README\.txt)$/.test(path)) continue
      const disk = await readFile(path).catch(() => null)
      if (!disk || !disk.equals(data)) stale.push(path)
    }
    expect(stale, 'stale brand files: run npm run brand').toEqual([])
  }, 120_000)

  it('the site serves the very files in the kit, and kit.json has their checksums', async () => {
    const { files, manifest: kit } = await drawn
    const site: Record<string, string> = {
      '/favicon.ico': 'app/favicon.ico',
      '/icon.svg': 'app/icon.svg',
      '/apple-icon.png': 'app/apple-icon.png',
      '/icon-192.png': 'public/icon-192.png',
      '/icon-512.png': 'public/icon-512.png',
      '/icon-maskable-192.png': 'public/icon-maskable-192.png',
      '/icon-maskable-512.png': 'public/icon-maskable-512.png',
      '/icon-maskable.svg': 'public/icon-maskable.svg',
      '/wordmark.svg': 'public/wordmark.svg',
    }
    expect(Object.keys(SERVED).sort()).toEqual(Object.keys(site).sort())
    for (const [url, kitPath] of Object.entries(SERVED)) {
      const served = await readFile(site[url]!)
      const entry = kit!.files.find((f) => f.path === kitPath)
      expect(entry, kitPath).toBeDefined()
      expect(entry!.sha256, `${url} and ${kitPath}`).toBe(sha(served))
    }
    for (const f of kit!.files) expect(sha(files.get(`${KIT}/${f.path}`)!), f.path).toBe(f.sha256)
    expect(kit!.version.sha).toMatch(/^[0-9a-f]{7}$|^unknown$/)
  }, 120_000)

  it('every manifest icon is a drawn file', async () => {
    const { files } = await drawn
    // A manifest icon is served from public/, or from app/ by Next's icon file convention (/icon.svg).
    for (const icon of manifest().icons ?? []) expect(files.has(`public${icon.src}`) || files.has(`app${icon.src}`), icon.src).toBe(true)
  }, 120_000)

  it('/built and its share card follow the same lot', () => {
    expect(MIZNER_PLAZA).toBe(TRACE_LOT)
  })

  it('/brand links only files the kit has', async () => {
    const { files } = await drawn
    for (const p of linkedFiles()) expect(files.has(`${KIT}/${p}`), p).toBe(true)
  }, 120_000)
})
