import type { Metadata } from 'next'
import { ViewPage } from '@/components/view-page'
import { SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: { absolute: 'Truffle: land value per acre in Boca Raton, lot by lot' },
  alternates: { canonical: '/' },
}

// What the site is and what its numbers come from, for search engines and assistants. Only the site and
// its public sources, never a lot: no address, owner or home is named here.
const structured = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Truffle',
    url: `${SITE}/`,
    description: 'Every lot in the city as a tile. Height is land value per acre, color is what it’s used for, and tapping it says why it’s worth what it is.',
    inLanguage: 'en',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Land value per acre, lot by lot, in Boca Raton',
    description: 'Land value per acre, use and zoning for each lot in Boca Raton, Florida, read from Palm Beach County property records and the City of Boca Raton zoning districts, with the pull date shown next to every number.',
    url: `${SITE}/value`,
    creator: { '@type': 'Person', name: 'Sami Kirberg' },
    isAccessibleForFree: true,
    spatialCoverage: { '@type': 'Place', name: 'Boca Raton, Palm Beach County, Florida' },
    variableMeasured: ['Land value per acre', 'Land use', 'Zoning district'],
    isBasedOn: [
      'https://gis.pbcgov.org/arcgis/rest/services/Parcels/PARCEL_INFO/FeatureServer/4',
      'https://bocagis.ci.boca-raton.fl.us/arcgissql/rest/services/Parcel_Viewer/PARCEL_ZONING_MAP/MapServer/0',
    ],
  },
]

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, '\\u003c') }} />
      <ViewPage mode="value" hunt />
    </>
  )
}
