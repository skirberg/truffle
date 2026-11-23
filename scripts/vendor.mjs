// Copies MapLibre's worker next to the page. MapLibre 6 finds its worker from its own module URL,
// which a bundler rewrites, so the app serves it from /maplibre/<version>/ and calls setWorkerUrl.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
const { version } = JSON.parse(readFileSync('node_modules/maplibre-gl/package.json', 'utf8'))
const dir = `public/maplibre/${version}`
mkdirSync(dir, { recursive: true })
copyFileSync('node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', `${dir}/maplibre-gl-worker.mjs`)
console.log(`maplibre worker ${version} -> ${dir}`)
