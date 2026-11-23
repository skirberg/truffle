// Checks a running site against its own kit: every file kit.json lists comes back 200 with the same sha256,
// every icon the site serves (tab, iPhone, install, manifest) is byte for byte the kit's copy, and every share
// card is a 1200 by 630 PNG. Run it on the live site after a deploy, or on `next start` before one.
// Run: npm run brand:live [-- https://www.truffle.city]
import { createHash } from 'node:crypto'

const BASE = (process.argv[2] ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.truffle.city').replace(/\/$/, '')
const sha = (b) => createHash('sha256').update(b).digest('hex')
const bad = []
const get = async (path) => {
  const r = await fetch(BASE + path, { redirect: 'follow' })
  return { r, body: Buffer.from(await r.arrayBuffer()) }
}

const { r: kr, body: kb } = await get('/brand/kit.json')
if (!kr.ok) {
  console.error(`${BASE}/brand/kit.json: ${kr.status}`)
  process.exit(1)
}
let kit
try {
  kit = JSON.parse(kb.toString('utf8'))
} catch {
  // A protected preview answers with its sign-in page instead.
  console.error(`${BASE}/brand/kit.json: not a kit (${kr.url})`)
  process.exit(1)
}
const byPath = new Map(kit.files.map((f) => [f.path, f]))

// Every kit file, a few at a time.
const queue = [...kit.files]
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const { r, body } = await get(`/brand/${f.path}`)
      if (!r.ok) bad.push(`/brand/${f.path}: ${r.status}`)
      else if (sha(body) !== f.sha256) bad.push(`/brand/${f.path}: sha256 differs from kit.json`)
    }
  }),
)

// The icons the site serves at its own addresses, and the manifest's.
const manifest = JSON.parse((await get('/manifest.webmanifest')).body.toString('utf8'))
const served = new Set([...Object.keys(kit.served), ...manifest.icons.map((i) => i.src)])
for (const url of served) {
  const { r, body } = await get(url)
  const want = kit.served[url] && byPath.get(kit.served[url])
  if (!r.ok) bad.push(`${url}: ${r.status}`)
  else if (!want) bad.push(`${url}: not in kit.json's served list`)
  else if (sha(body) !== want.sha256) bad.push(`${url}: differs from the kit's ${want.path}`)
}

// The share cards, and the home page's own og:image (with its cache-busting query).
const html = (await get('/')).body.toString('utf8')
const og = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1]
const cards = [...kit.shareCards, ...(og ? [new URL(og).pathname + new URL(og).search] : [])]
for (const url of cards) {
  const { r, body } = await get(url)
  const png = body.subarray(1, 4).toString('latin1') === 'PNG'
  const [w, h] = png ? [body.readUInt32BE(16), body.readUInt32BE(20)] : [0, 0]
  if (!r.ok || !png || w !== 1200 || h !== 630) bad.push(`${url}: ${r.status} ${png ? `${w}x${h}` : 'not a PNG'}`)
}

console.log(`${BASE}: kit ${kit.version.sha} (${kit.version.date}), ${kit.files.length} files, ${served.size} icons, ${cards.length} share cards checked.`)
if (bad.length) {
  console.error(bad.join('\n'))
  process.exit(1)
}
console.log('Every file matches the kit.')
