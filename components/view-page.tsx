import { Truffle } from './truffle'
import type { Mode } from './board'
import { getSummary } from '@/lib/store'

export async function ViewPage({ mode, hunt = false }: { mode: Mode; hunt?: boolean }) {
  const summary = await getSummary()
  return <Truffle key={mode} initialMode={mode} initialHunt={hunt} initialLot={null} initialSharing={null} summary={summary} />
}
