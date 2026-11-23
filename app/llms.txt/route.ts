import { getSummary } from '@/lib/store'
import { sourceLine } from '@/lib/copy'
import { SITE } from '@/lib/site'

// /llms.txt: what Truffle is and how to read its numbers, for AI assistants. Built from the same summary
// the map reads, so the sources and pull dates match the site. Never names a lot, an owner or a home.
export async function GET() {
  const { pulls, coverage } = await getSummary()
  const covered =
    coverage === 'county'
      ? 'Palm Beach County, Florida, starting with Downtown Boca Raton and West Boca'
      : 'Downtown Boca Raton and West Boca, Florida'
  const text = [
    '# Truffle',
    '',
    `> Truffle (${SITE}) is a map of a real city where every lot is a tile. A tile’s height is its land value per acre, its color is what it’s used for, and tapping it says why it’s worth what it is. It covers ${covered}.`,
    '',
    'Land value per acre is the county’s land value for a lot divided by the lot’s area in acres. It leaves the building out.',
    '',
    '## Views',
    '',
    `- [Value](${SITE}/value): land value per acre for every lot, with its use`,
    `- [Rules](${SITE}/rules): what the city’s zoning lets each lot in Downtown Boca Raton be`,
    `- [Changing](${SITE}/changing): West Boca lots added to the county map since 2023`,
    '',
    '## How it’s built',
    '',
    `- [How it’s built](${SITE}/built): the stack and why each piece was chosen, where every number comes from, how the map is drawn, how it’s checked and what it keeps`,
    '',
    '## Brand',
    '',
    `- [Brand kit](${SITE}/brand): the logo, the mark, the colors and the type; every file is listed with its checksum in [kit.json](${SITE}/brand/kit.json)`,
    `- [Design tokens](${SITE}/brand/colors/truffle.tokens.json): the colors, the roles they play, type, spacing, shadows and motion in the W3C Design Tokens format, colors in OKLCH with their hex. Color means use; truffle brown is only ever the lot someone picked`,
    '',
    '## Sources',
    '',
    sourceLine(pulls),
    '',
    ...pulls.map((p) => `- [${p.name}](${p.url}), pulled ${p.pulled}`),
    '',
    'Truffle does not ask the county for owner names, mailing addresses, homestead flags or sales.',
    '',
  ].join('\n')
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
