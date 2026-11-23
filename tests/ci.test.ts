import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// The checks on every pull request (.github/workflows/ci.yml) are the checks `npm run check` runs locally.
// Add a check to one and not the other and this fails.
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
const ci = readFileSync('.github/workflows/ci.yml', 'utf8')
const runs = [...ci.matchAll(/^\s+run: (.+)$/gm)].map((m) => m[1]!.trim())

describe('the pull request checks', () => {
  it('run every step of npm run check, in its order', () => {
    const steps = pkg.scripts.check!.split('&&').map((s) => s.trim())
    const inCi = steps.map((s) => runs.indexOf(s))
    expect(steps.filter((_, i) => inCi[i] === -1), 'in npm run check, missing from ci.yml').toEqual([])
    expect(inCi, 'ci.yml runs them in another order').toEqual([...inCi].sort((a, b) => a - b))
  })

  it('pin every action to a full commit', () => {
    const uses = [...ci.matchAll(/uses: ([^\s]+)/g)].map((m) => m[1]!)
    expect(uses.length).toBeGreaterThan(0)
    expect(uses.filter((u) => !/@[0-9a-f]{40}$/.test(u))).toEqual([])
  })

  it('run on every pull request and every push to main', () => {
    expect(ci).toMatch(/^on:\n {2}pull_request:\n {2}push:\n {4}branches: \[main\]/m)
  })
})
