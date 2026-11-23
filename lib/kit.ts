import { color, useColor } from '@/lib/tokens'

/**
 * What /brand shows and links, all of it drawn by scripts/brand.mjs into public/brand/. tests/brand.test.ts
 * holds every path here to a file the generator makes, so the page can't link a file that isn't there.
 */
export const KIT = '/brand'

export const LOGO_PNG = [512, 1024, 2048] as const
export const MARK_PNG = [64, 128, 256, 512, 1024] as const

export const logos = [
  { key: 'color', name: 'Color', note: 'On light grounds', ground: color.paper },
  { key: 'reversed', name: 'Reversed', note: 'On dark grounds', ground: color.truffle },
  { key: 'black', name: 'Black', note: 'One color', ground: '#FFFFFF' },
  { key: 'white', name: 'White', note: 'One color', ground: '#000000' },
] as const

export const marks = [
  { key: 'color', name: 'Color', ground: color.paper },
  { key: 'reversed', name: 'Reversed', ground: color.truffle },
  { key: 'black', name: 'Black', ground: '#FFFFFF' },
  { key: 'white', name: 'White', ground: '#000000' },
  { key: 'tile', name: 'Tile', ground: color.paper },
] as const

export const social = [
  { file: 'og-1200x630.png', name: 'Link preview', w: 1200, h: 630 },
  { file: 'x-header-1500x500.png', name: 'X header', w: 1500, h: 500 },
  { file: 'linkedin-banner-1584x396.png', name: 'LinkedIn profile', w: 1584, h: 396 },
  { file: 'linkedin-cover-1512x256.png', name: 'LinkedIn page', w: 1512, h: 256 },
  { file: 'youtube-banner-2560x1440.png', name: 'YouTube', w: 2560, h: 1440 },
  { file: 'github-social-1280x640.png', name: 'GitHub', w: 1280, h: 640 },
  { file: 'instagram-1080x1080.png', name: 'Instagram square', w: 1080, h: 1080 },
  { file: 'instagram-1080x1350.png', name: 'Instagram portrait', w: 1080, h: 1350 },
  { file: 'story-1080x1920.png', name: 'Story', w: 1080, h: 1920 },
  { file: 'avatar-800.png', name: 'Avatar', w: 800, h: 800 },
] as const

export const swatches = [
  { name: 'Paper', hex: color.paper, role: 'Ground of every screen' },
  { name: 'Card', hex: color.card, role: 'Panels and the phone sheet' },
  { name: 'Truffle', hex: color.truffle, role: 'Type, and the lot you picked' },
  { name: 'Soft', hex: color.soft, role: 'Secondary text' },
  { name: 'Line', hex: color.line, role: 'Hairlines, and the lot under fog' },
  { name: 'Water', hex: color.water, role: 'Rivers, lakes and the sea' },
  { name: 'Homes', hex: useColor.homes, role: 'Sanborn yellow' },
  { name: 'Shops and offices', hex: useColor.biz, role: 'Sanborn pink' },
  { name: 'Civic and parks', hex: useColor.civic, role: 'Sanborn blue' },
  { name: 'Vacant', hex: useColor.vacant, role: 'Empty land' },
] as const

/** Every file the page links, as a path under public/brand/. */
export function linkedFiles(): string[] {
  return [
    ...logos.flatMap((l) => [`logo/truffle-logo-${l.key}.svg`, ...LOGO_PNG.map((w) => `logo/truffle-logo-${l.key}-${w}.png`)]),
    ...marks.flatMap((m) => [`mark/truffle-mark-${m.key}.svg`, ...MARK_PNG.map((s) => `mark/truffle-mark-${m.key}-${s}.png`)]),
    ...social.map((s) => `social/${s.file}`),
    'colors/tokens.json',
    'colors/tokens.css',
    'colors/truffle.tokens.json',
    'colors/colors.md',
    'type/Gabarito-OFL.txt',
    'email/signature-logo@2x.png',
  ]
}
