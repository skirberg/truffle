# Truffle design

The design source of truth for the build, written from the Truffle brand book and `brand/tokens.json`. Where this file and the tokens disagree, the tokens win. Nothing here is new: it is the brand book, made specific for the code.

## The idea

Make any real city as easy to understand as SimCity. Every lot is a tile, its height is its land value per acre, its color is what it's used for, and tapping it says why it's worth what it is.

Four rules settle every argument:

1. Show the why, not just the price. Every lot answers why it's worth what it is.
2. Every number has a source, and the date it was pulled.
3. Let people play before they read. The map is fun to poke before there's any goal.
4. Never call a neighborhood good or bad. Show what's there; people judge.

The test for any screen: if it isn't easier to read than the county website, it's wrong.

## Color

Color means use. Height means value, for every lot including the one you picked: it is never raised above what it's worth. In Rules, color means what the zoning allows. Truffle brown means the lot you picked, and nothing else on the map is that color.

| Token | Hex | Role |
|---|---|---|
| `paper` | `#F2EDE3` | Ground of every screen, and the streets between tiles |
| `card` | `#FBF8F2` | Panels, the phone sheet, pills on the map |
| `truffle` | `#2A1E17` | Type, and the lot you picked |
| `truffle-side` | `#4A3A2F` | Side of the picked tile in the share image |
| `soft` | `#6E6658` | Secondary text (5.35:1 on card, 4.86:1 on paper) |
| `faint` | `#736B5D` | Source lines and placeholders (4.97:1 on card, 4.51:1 on paper) |
| `line` | `#DDD5C6` | Hairlines, the sheet's handle |
| `water` | `#C1CFDF` | Rivers, lakes and the sea on the map. Not a use |

Use colors come from the Sanborn fire insurance maps. Each is `[top, left side, right side]`; on the map the light makes the sides, from the upper left.

| Use | Top | Matches county use text containing |
|---|---|---|
| Homes | `#F4C542` | single family, townhouse, condo, multifamily, residential |
| Shops and offices | `#EE8577` | store, restaurant, office, commercial, bank, hotel, shopping, auto sales, financial, motel, leasehold |
| Civic and parks | `#86ABDB` | municipal, park, church, school, county, state, golf, religious, river, schl |
| Vacant | `#E4DED1` | vacant |
| Other | `#D6CFC0` | anything else |

Order matters: homes, then shops, then civic, then vacant, then other.

Zoning (Rules) colors and the codes in each family live in `brand/tokens.json` under `mappings.zoningFamilies`, so a rule is data. The pipeline, the map and the panel all read that one list.

| Family | Color | Plain words |
|---|---|---|
| Single-family homes | `#F4C542` | One house per lot. |
| Duplexes | `#E9B53A` | Up to two homes per lot. |
| Apartments and townhomes | `#D9A02A` | More than one home per lot. |
| Downtown | `#EE8577` | Shops, offices and apartments, built taller than anywhere else in the city. |
| Shops and offices | `#D96A5B` | Businesses, no homes. |
| Public land and parks | `#86ABDB` | Owned and used by the public. |
| A special district | `#D6CFC0` | A district with its own rules. |
| No zoning on record | `#E4DED1` | (legend row only) |

Contrast is checked, not assumed: `npm run contrast` tests every text and color pair the product uses, including numbers on their pills over each use color, in the default look and in the mode below, and prints APCA's lightness contrast (Lc) beside each text pair as a second look. WCAG 2.2 AA is the rule; APCA informs and never fails.

### Roles and modes

Nov 22, 2026. The colors above are the primitives, and they never change. Between them and the components sits a layer of roles (`role` in `brand/tokens.json`, `--role-*` in `brand/tokens.css`), the way GitHub's Primer puts functional tokens over its base colors: a mode moves a role, never a brand color.

| Role | Default | With more contrast |
|---|---|---|
| `surface.ground`, `surface.raised`, `surface.inverse` | paper, card, truffle | the same |
| `text.primary`, `text.onInverse` | truffle, paper | the same |
| `text.secondary` | soft (4.86:1 on paper, Lc 68) | truffle side (9.29:1, Lc 85) |
| `text.source` | faint (4.51:1 on paper) | truffle side (9.29:1) |
| `border.hairline` | line | soft (5.35:1 on the card, so an edge reads) |
| `border.focus`, `accent.picked` | truffle | the same |
| `state.calledRight`, `state.missed` | truffle, the secondary ink | the same |

- **More contrast** is for anyone whose device asks for it (`prefers-contrast: more`): text reaches 7:1, as high-contrast themes aim for. Color still means use; the map doesn't change.
- **Forced colors** (Windows high contrast): the system paints the page, so the active view takes the system highlight, buttons and pills get an outline, and the marks in a picture (the skyline's bars, the land bar, the walk track, the record's tiles, a zoning family's swatch) keep their colors, as a chart does.
- **One theme, light.** The brand book draws Truffle on paper, so there is no dark theme; the page says `color-scheme: light` from its first byte, so a phone in dark mode keeps light scrollbars and fields.
- **sRGB, not P3.** The map draws its tiles in sRGB, and a key must match the map to the bit, so no color is widened to Display P3. The token file gives every color in OKLCH too; measured there, each use color's sides step down evenly (0.08 then 0.07 in lightness, in every hue).
- **Shadows are the ink**, never black: truffle at 8 to 15% through `color-mix()`.

## Type

One family, Gabarito, self-hosted, with tabular figures (`font-feature-settings: "tnum"`) everywhere so values line up as they change. The page's file is cut to what the site sets (Latin with its accents, punctuation, currency): 45.7 KB, from 58.8. Map labels and share images keep the whole font. `next/font` sizes its Arial fallback to Gabarito's metrics, so nothing moves when it arrives. Headings balance their lines and running text never leaves one word alone on its last line (`text-wrap: balance` and `pretty`).

The app uses the grid's scale below (The grid): fixed steps, because the desktop card and the phone sheet are about the same width and the brand book sets the phone's sizes on purpose. The brand page, a document, uses three fluid steps (display 34 to 72, heading 28 to 44, number 40 to 60) that grow from 320 to 1440 px in rem. No component or page sets a font size by hand: `npm run grid` fails on one.

| Style | Size | Weight | Tracking |
|---|---|---|---|
| Display | 72 | 800 | -0.035em |
| Number | 60 (46 on phones) | 800 | -0.04em |
| Title | 38 (28 on phones) | 800 | -0.035em |
| Lead | 18 (16 on phones) | 500 | 1.4 line height |
| Body and reasons | 17 (16 on phones) | 500 | 1.38 to 1.4 line height |
| Address and labels | 17 | 600 | |
| Tabs | 15 (14 on phones) | 700 | |
| Source line | 13 | 500 | |
| Map credit | 12 | 500 | |
| Numbers on tiles | 11 | 600 | |

Gabarito ships three ways from one source font: woff2 for the page (`app/fonts/`), TTF for share images (`assets/fonts/`), signed-distance glyph files for map labels (`public/glyphs/`). Truffle Sans, a display face drawn from the logo's t, was built and compared; Gabarito stayed.

## Logo

The t is a mushroom: a perfect semicircle cap sitting on the x-height, a stem the same width as every stroke, and a foot that turns on two circles into the tail. The icon is the same t, homes yellow on truffle brown.

- Files: `brand/wordmark.svg` (the source, as drawn), `brand/wordmark-on-dark.svg`, `brand/icon.svg`, `brand/icon-square.svg`, `brand/mushroom.svg`, `brand/mushroom-on-dark.svg`, PNG icons from 180 to 1024 px. The icons are drawn with true arcs from the construction (`scripts/brand.mjs`): cap radius 215 on the x-height, stem 360 to 530 from 469, foot radii 235 and 65 around (595, 700), tail end radius 85.
- Tab icon: at 16 and 32 px the mark is a quarter larger, its cap edge and stem on whole pixels, with at least a pixel under the cap. 48 px and up use the brand icon as drawn. The iPhone and maskable icons are full bleed; the phone rounds them. The install icons come in both shapes at 192 and 512 px, plain and maskable, beside the two vectors.
- Share cards: 1200 by 630, paper coming in from the left under the words, the wordmark top left, the address bottom left, and the real lots behind, drawn at the map's own camera. The front door shows the call (the city lit, and the first lot lying flat under fog with its truffle outline and the pin with its question mark), Value the uses, Rules the zoning, Changing West Boca, How it's built the county's outlines turning into tiles. A lot's card is its value and its tile. A link to a lot with no record, or one that can't be called, gets a view card that says so ("We have no record of that lot") over the front door's art, a lot under fog with its question mark, never a tile for a lot that isn't there.
- Clear space is the cap's height on every side. The wordmark is never under 72 px wide; below that, use the icon.
- On the map the wordmark sits on a card pill (top left, 26 px tall).

### The kit

`/brand` and `public/brand/` hold the kit, every file drawn by `scripts/brand.mjs` (README, Icons and share cards), never by hand.

- Logo variants: color (truffle brown, for light grounds, the wordmark as drawn), reversed (paper letters with the cap in homes yellow, the brand book's version for dark grounds), black and white for one-color use. The mark has the same four plus tile, the app icon. SVG is the vector master; there is no PDF.
- The banners are the board: downtown's real lots from the map's tiles at the map's camera (pitch 55, bearing -35), paper coming in from the side under the wordmark the way the share cards do, and one lot in truffle brown, the lot you picked. That lot is the front door's first lot, a business, never a home. Each banner keeps what its network crops or covers clear (the X profile photo, YouTube's middle 1546 by 423, a story's top 250 and bottom 340 px). Truffle has one theme, light, so there are no dark banners.
- The avatar is the square icon, full bleed: the mark's farthest point is about a third of the way out from the middle, so it reads in a circle crop.
- `/brand` is set like the brand book: big statements on paper, rows with hairlines, few words. Clear space and the smallest size are drawn with the wordmark's own paths; the four don'ts (stretched, recolored, outlined, straight on the board) are drawn the same way, never with a copy of the logo.

### How it's built

Nov 22, 2026. `/built` is `/brand`'s sibling, cut harder: a heading per section, then pictures and a few labeled facts (a soft label beside each fact, one hairline row each). No paragraphs, no line that repeats its heading, nothing in capitals. About 300 words, most of them names, versions, fields and numbers; a phone scrolls about 3,600 px of it.

- **It opens on the board turning.** Downtown at Value's camera, read left to right the way the pull reads it: the lots lie flat in the line color with the streets as gaps, the county's outlines; past Mizner Plaza they stand at their heights in their use colors, and Mizner Plaza stands at its own height in truffle brown where the two meet. The same art is the page's share card (`brand/share/built.svg`); the page sets it without the card's words (`public/built-board.webp`, 2400 by 1260).
- **One lot, start to finish.** Mizner Plaza (`TRACE_LOT` in `lib/built.ts`, the same id the card uses, held by `tests/brand.test.ts`) as four tiles in one row, drawn with the panel's own `Tile`, each with its number and a word or two: its land, its value per acre, its height in shop pink, then truffle brown, a link to its lot page. Every number is read from its record at build.
- **Every lot is a tile.** Six tiles at $1M, $2M, $4M, $8M, $16M and the top of the scale, each with its meters, then three facts: height, color (the use tiles) and streets.
- **Chosen for this product.** One line each: the choice and why, its version read from the installed packages; then what was left out, struck through, in the same list.
- **Every number has a source.** Each source the pull recorded, linked, with the day it was pulled (and its count on wider screens).
- **Checked before it ships.** The five widths `npm run qa` opens every page at (`QA_WIDTHS`, shared with `e2e/qa.spec.ts`) drawn side by side to scale, a phone with its sheet at half and a desktop with its card, then six labeled facts.
- **What it keeps.** One sentence, then the fields the pull asks the county for beside the ones it never asks for, struck through.

It is linked where `/brand` is: the open map's panel ends with two quiet links, "Brand kit" and "How it’s built", and `/brand`'s footer links it; both pages are in the sitemap and `/llms.txt`.

## The map

- Every lot is a tile: the county's own outline, pulled in 0.9 m so streets read as gaps.
- Height in meters is `min(60, 3 + 46 * sqrt(landValuePerAcre / 16,000,000))`. Unvalued lots sit at 1 m.
- Light: viewport anchor, white, intensity 0.38, position `[1.3, 215, 40]`. Sides are never painted separately; the light makes them.
- Camera:

| View | Center | Zoom | Pitch | Bearing |
|---|---|---|---|---|
| Value | -80.0838, 26.3508 | 15.7 | 55 | -35 |
| Rules | -80.0838, 26.3508 | 15.7 | 45 | -35 |
| Changing | fits West Boca lots added since 2023 | | 50 | -20 |
| A lot | the lot | 17.2 (17.4 from search) | 58 | -35 |
| Phone, Value and Rules | -80.0836, 26.3512 | 14.9 | as above | as above |

Desktop cameras pad 400 px on the right for the panel; phone cameras pad the bottom half of the screen for the sheet.

- Rules: tiles are 3 m, the picked one 10 m. Changing: lots added since 2023 stand 6 m in their use color; older lots lie flat (0.3 m) in vacant gray; the picked one is 14 m.
- Close in (zoom 16.6 and up), valued tiles show their land value in millions per acre on a card pill that sits on top of the tile (`symbol-height-offset` is the tile's height). Collision detection keeps about 40 on screen; the picked lot's number is on a truffle pill, placed first and never hidden. In Value the picked lot stands at its own height like every other; what marks it is its truffle brown and its truffle pill, which is never hidden behind a taller neighbor.
- The OpenStreetMap credit is always on screen on a card pill: bottom left on desktop, and on phones 8 px above the sheet's top edge, moving with it, where Apple's map guidelines put a map's legal line (about 10 points above a card), so nothing but the top bar sits over the map's top. With the sheet at its top stop there is no map left between the sheet and the top bar, so the credit moves to the foot of the sheet; it never sits over the wordmark or the tabs.

### Around the lots

The tiles stand on a plain map so a place reads as a place, drawn from OpenStreetMap in the brand's colors and nothing else:

- Water in its own tint, `water` (#C1CFDF), never the civic blue: blue means civic land and parks, and water is not a use. The tint is the quietest one the tokens give, the civic blue at 45% over paper set down as one flat color. The county also draws rivers, lakes and canals as lots and files them under a civic use, so the water lies just over those flat lots (1.1 m in Value and Changing, 3.1 m in Rules, where every tile is 3 m) and they read as water, not as parks.
- Roads under the tiles, so a street is the gap between lots. Highways and main roads in vacant gray, side streets and service roads in line beige. Widths grow with the zoom (a highway is 1.6 px at zoom 11 and 22 px at 18).
- Road names from zoom 14, along the road, Gabarito SemiBold 10 to 13 px in soft brown with a paper halo.
- Town and neighborhood names in Gabarito Bold, truffle brown on a card halo: cities 18 px, towns 16, villages 14, neighborhoods 13. They give way at zoom 15.5, where the tiles say enough.
- A lot that is a named place says so on its tile: "Mizner Park" over "8.4". A lot takes a name when a named outline covers it (a park, a school, a mall) or when exactly one named business stands on it. A row of shops with no outline of its own takes no tenant's name, and things that stand on a lot without being it (a fountain, a bench, a playground) never name it.

### The whole state

Outside Palm Beach County every lot comes from the state's tax roll. The map starts further out (zoom 5.5 shows the state; tiles from zoom 7, highways from 6, city names from 6), so Florida reads as a field of tiles before any town does. Search finds any town or neighborhood by name and flies over it (zoom 13 for a city, 14.5 for the rest).

## Motion

| Event | Motion | Reduced motion |
|---|---|---|
| Tap a lot | It turns truffle brown at its own height | The same |
| Switch views | The camera eases over 1.6 s | Jumps |
| Search or open a lot | The camera flies over 1.5 s | Jumps |
| Move the map | Glides and keeps momentum | Stops where you let go |
| Phone sheet | Follows the finger, settles in 0.45 s | Settles at once |
| The front door loads | The city is there from the first paint (the first frame), and the map fades in over it in 0.3 s once its lots draw | The map replaces it at once |

Every duration and the easing are tokens (`motion` in `brand/tokens.json`): a press answers in 100 ms, a chevron turns in 200, the first frame fades in 300, the sheet settles in 450, numbers and the level fade in 500, a search flies 1500 and a view change 1600, all easing out (`cubic-bezier(0, 0, 0.2, 1)`). No component sets a duration by hand.

## Layout

Desktop and tablet (760 px and up):

- Top left: the wordmark pill, then the view tabs (Value, Rules, Changing) as one pill with the active tab in truffle.
- Right: the panel, a card 384 px wide, 24 px from the edges, radius 24, shadow `shadow.panel` (truffle at 12%, 8 px down, 40 px blur). Search on top, then the panel body, then the legend at the bottom, then the source line.

Phone (under 760 px):

- Top bar the same, smaller. The map credit rides just above the sheet, and at the sheet's top stop sits at its foot.
- The panel is a bottom sheet, edge to edge, with three stops: a 148 px peek showing the search, half the screen (where it starts, and where a picked lot opens), and 92%. It works like a maps app: a swipe up anywhere on it raises it, and only at the top stop does its content scroll; at the top of that scroll a swipe down lowers it. A flick can skip a stop. Tapping the grip steps it up, or back down from the top. Focusing search raises it so the results clear the keyboard. It never closes and never traps focus; the map behind stays live.
- A picked lot has a Share button beside the way back: the phone's share sheet, or the link copied on a computer.

## The fog

The front door opens on the lit city: every lot at its height in its use color, seen from wide over downtown (zoom 13.6, pitch 40, bearing -20). Once the lots have drawn it holds for 0.7 s and flies down to the first lot over 4.2 s, to zoom 16.4 on a phone and 17.2 on a desktop. One lot is under fog: flat at 1.2 m, lying still in the line color (#DDD5C6), with a truffle pill holding a 16 px question mark just over it. The call is two equal buttons, Less and More, in truffle on paper text, 56 px tall, pressing to 0.97, under the lot's name and one line: More or less per acre than its neighbors? After the call the fog comes off and the lot grows to its true height over 0.9 s, easing out, in truffle brown, and stops there: a lot called worth less stands lower than its neighbors. With reduced motion the camera jumps, the lot doesn't breathe, and it stands at its height at once.

Next lot picks a lot a person can see and reason about: a short walk from the last one, at least a tenth of an acre and 20 m across, between $500K and $24.6M an acre (where the height scale tops out), clearly above or below its neighbors but within six times their middle, and for preference standing in the open rather than behind a taller lot. Slivers and outliers keep their own pages and are never asked about.

The lot to call is marked the way a maps app marks the one place that matters among many shapes: a truffle pin (the pill with a short tail pointing down at the lot) holding the question mark, and a truffle outline around the lot drawn over everything, the way a game outlines the unit you've selected even behind a wall. Before the call the map shows heights and colors only: the numbers on tiles stay hidden until the answer, as a map game shows the distance only after the guess, and only the big places are named (supermarkets, schools, parks, churches, hotels, libraries, museums, hospitals), so the call has its context without a wall of shop names. Both are done with opacity, not layout: a layout change makes the map re-read every tile, and on a phone at the moment of the answer that spent enough memory for Safari to drop the page. The panel says what the lot is without an article ("Place of worship · Boca Raton"), its name, one line (Worth more or less per acre than its neighbors?) and the two answers with arrows, down for Less and up for More, the way the lot will stand lower or taller. Skip is a word, not a cross. The answer keeps to what ArcGIS's pop-up guidance asks of any map pop-up, only what matters: the verdict with Next lot beside it, the picture of this lot beside the typical one around it, the reason in a few words with its sentence a tap away, the record as a row of tiles, and the source line every panel ends with ("Values: Palm Beach County property records. Pulled Nov 4, 2026."), since the answer is numbers. The reason answers the question that was asked, so it compares the lot with the valued lots within a few blocks, from their records, two facts at most: its size against the typical lot around it ("It’s a big lot: 2.5 acres, where the typical lot around it is 0.2 acres. Its value is spread over more ground."), what it is when most of them are something else ("Most lots around it are homes. This one is a place of worship."), its land share against theirs, and its year built where the records carry one. Size is given only when it runs the way the arithmetic does (bigger and worth less per acre, smaller and worth more). When size and use match, it says what the county puts on the land against the typical lot; when nothing in the records sets it apart, it says so and guesses nothing.

## A lot a day, and a lot sent to a friend

Nov 20, 2026. The front door's first lot changes every day and is the same for everyone that day, the way Wordle gives one word a day. The day's number counts calendar days from Nov 20, 2026 (Lot No. 1) on the visitor's own calendar, and picks from a fixed list in a fixed order (`data/daily.json`, `lib/daily.ts`). After the day's lot the rounds go on as before, nearby; they never land on a lot you've called or on a lot kept for another day.

What can be a day's lot (checked against every record downtown and in West Boca; `tests/daily.test.ts` holds the list to what the committed sample can show): an ordinary business lot downtown or in West Boca, never a home, a place of worship or civic land; a name or an address to call it by; at least 12 valued lots within a few blocks; at least half again above or below their middle, so the call isn't a coin flip; and a reason that explains it in the records' own terms (its size, what it is among what's around it, or how much of its worth is land), never "the records don't say". Both answers come up between 30% and 70% of days and never more than three days running. 39 lots qualify in the full records.

- **The call.** The label carries the number: "Lot No. 12 · Car dealer · Boca". The first call of a visit has one more line under Less and More, in soft 13 px: "A truffle is value hidden underground. You find it by searching." It says what the name means, once, where the hunt happens, and nowhere else.
- **The answer.** It settles against the records of the valued lots within 350 m, read by the server (`/api/call/[id]`, `lib/call.ts`), so every visitor gets the same answer for the same lot; the map's tiles are only the fallback for lots with no record. The footer holds the record, a row of tiles (one per call, the latest ten, truffle when called right) beside "4 of 6", and **Send to a friend**, a paper pill with the share glyph, 48 px tall.
- **Coming back.** Your calls are kept in this browser only (`localStorage["truffle:calls"]`, `lib/record.ts`). The same day, the day's lot opens answered, standing at its height with its verdict; the next day there is a new one; the record carries over.
- **Send to a friend.** The phone's share sheet where there is one (the Web Share API), else the line and the link go to the clipboard and the button itself turns to "Copied" with a check (a screen reader hears "Copied. Paste it to a friend.") The line is how you did and where, never which way the lot went: "Truffle No. 12: called it in Boca" ("missed it" when you didn't; no number for a lot that wasn't the day's). The link is `/call/<lot>?c=<code>`: the code carries your call and the day's number, mixed with the lot's id so it doesn't read as More or Less. No account and nothing stored on a server about anyone.
- **A friend's link.** It opens the front door on that lot under fog, with "A friend called this one" as its label. Their call stays hidden until the friend makes theirs; then the label sets the two side by side, "You both said Less" or "You said More, they said Less", over the verdict. Next lot goes on to the day's lot, and the address goes back to `/`. The page is not indexed; the lot's own page is the one to find.
- **Its preview.** A 1200 by 630 card like the front door's: the lots around it standing in their use colors at the lot camera, this one flat under fog with its truffle outline and pin, and the question: the lot's name and town small, "Worth more or less per acre than its neighbors?" large, "A friend made their call. Make yours." under it. The image has no query string, so it is the same picture for every link to that lot and can't give a call away. A home goes by what it is ("A single-family home"), never by its address, in the preview and the page's title.

## The first frame

The front door used to show about a second of empty paper before the map drew. Now the page's HTML carries a picture of the lit city at the map's opening camera (map.hunt.wide over the Value center), drawn by `scripts/brand.mjs` from the same tiles with the map's own perspective (36.87 degree field of view, 512 px tiles), one for phones (480 by 1000 at twice the pixels) and one for everything wider (2560 by 1600). It sits at 1:1 in the middle of the screen, so the map lands on it exactly, and fades out in 0.3 s once the map's lots have drawn. It has no water or roads; those fade in with the map.

## The grid

Everything sits on a 4 px grid (brand/tokens.json, `grid`), the 8-point system most product teams use, with 4 as the half step. Spacing runs 4, 8, 12, 16, 24, 32, 48, 64. Margins are 16 px on a phone and 24 on a desktop. The desktop card is 384 px wide with 24 px padding: three 104 px columns with 12 px gutters, so the fact tiles and the Less and More answers land on columns. The phone sheet pads 16. Taps are at least 48 px, main buttons 56; corners are 8, 12 or 24. Text line heights are multiples of 4 so baselines land on the grid: number 56/56, title 28/32 (24/28 on a phone), headline 20/24, body 17/24, small 15/20, label 13/16, credit 12/16 (the map credit), tag 11/12 (a word inside a 36 px button) (Tailwind `text-ui-*`). Font sizes may sit between grid lines; nothing else may. `npm run grid` reads every component and fails on any hand-set spacing, size or radius off the grid, and on any font size, color or duration set by hand in a component or page, and it runs in `npm run check`.

The front door was wireframed and then designed on this grid before the code was rebuilt to match: a 13/16 label over a 28/32 title, sections 24 apart, the call as two 56 px answers 12 apart, and the reveal (now a picture of this lot beside the typical lot within a few blocks, see Show, don't tell) with the reason under it and a footer with the record; Next lot sits by the verdict, so it stays in reach with the sheet at half. On a desktop the card hugs what it holds, like a place card; on a phone the sheet stays low over the call, its peek ending 16 px (the sheet's padding) under Less and More plus the phone's safe area, whatever length the lot's name runs to, so the lot stays in view; it comes up to half for the answer.

## What things are, on the map

From zoom 15.4, named places from OpenStreetMap sit on the map the way a maps app or SimCity labels them: a 9 px dot with a paper ring and the name in Gabarito SemiBold, truffle ink on a paper halo. The dot is shop pink for shops, food and businesses and civic blue for schools, churches, parks and public services. Parking, artwork and loose building tags stay off. In the fog the places still show: knowing a Publix or a school sits next door is part of making the call.

After a call, the called lot carries its result on the map ("You called it" over "$7.1M an acre", in the truffle pill). Its neighbors show their numbers from the camera's own zoom the whole time, so the lot reads against them without opening the panel.

## The panel

The panel is built like a place card (components/card.tsx): a title with the place's category under it and round Share and Close buttons at its trailing edge, then pictures in rows divided by hairlines (see Show, don't tell). Grouped sections (a 13 px bold label in soft ink over a paper block, radius 14, rows divided by a 1 px line inset 14 px) remain only where there is no picture to draw, as for an unvalued lot. Search is a paper field with a magnifier, radius 14.

Every panel ends with one source line naming each source and the date it was pulled. When every source was pulled the same day it reads: "Values: Palm Beach County property records. Zoning: City of Boca Raton. Walk reach: OpenStreetMap streets. Pulled Nov 4, 2026." When the days differ, each source carries its own date. With more than one source the line folds under one line that keeps the days, "Sources, pulled Nov 2 to 4, 2026", and opens with a tap; a single source stays a line.

A picked lot first says what it is. A named lot shows its name at the title size, 28 px extra bold (24 on a phone), the same as on the front door, then "132 NE 2nd St · Shops"; an unnamed one shows its address with what it is under it ("A single-family home, built 1988"). Outside Downtown Boca Raton and West Boca the town follows on its own line. What it is comes from OpenStreetMap's kind when a named place stands on the lot, otherwise from the county's or the state's use, rewritten from assessor's words ("office bldg-non medical 1 to 3 stories" reads "Offices", "residential common area/element" reads "Shared land in a neighborhood", "mht/modular coop" reads "Manufactured homes"). The assessor's own text never reaches the page: a use with no plain words yet is named by its color on the map ("A business", "Civic land"), and a test holds every use in the committed data to the list. A lot with no address is titled by what it is ("A golf course") with "No street address on record" under it. The search field names what it can find: a Florida town or Palm Beach County address with the database; without it, a downtown Boca Raton address, or a West Boca address in Changing and on West Boca lots.

Under the value sits the lot's skyline: its whole comparison set (every valued lot downtown, in West Boca, or in its town) as 48 bars from lowest to highest per acre, drawn with the map's own height formula and stretched between the lowest and highest so the spread shows, in vacant gray with this lot's bar in truffle and its rank pinned over it in a truffle pill ("Beats 71%"), the way the map pins the picked lot's number. One line under it: "613 lots downtown, low to high". It turns the rank sentence into a picture, the way value-per-acre studies compare one parcel with its neighbors.

Then it shows its address, its value per acre at the number size with "an acre" after it, and up to four reasons, each drawn (the skyline above, the land against the building as one bar, the walk on a track against the typical lot's, the rule as its own color and name) and each carrying its sentence as its label. The sentences sit under "In words", a tap away:

1. Land share and building value: "The land is 92% of the value. The house is worth $112K." (or "The house is valued at $0. All of the value is the land."). A share that would round to 100% beside a building that is worth something reads "nearly all", in the reason and on the fact tile.
2. Walk reach against the typical lot: "A 10-minute walk reaches 17.0 km of street. The typical lot here reaches 14."
3. Rank: "Worth more per acre than 71% of valued lots downtown." Downtown and West Boca lots are ranked in their area, every other lot in its town.
4. Zoning in plain words: "Zoned for single-family homes." Outside Palm Beach County there is no zoning layer to read, so it says "No zoning in the records."

Lots outside Palm Beach County have no walk reach yet, so their panel has three reasons at most.

## Show, don't tell

Nov 20, 2026. The panels had become sentences about a picture that was already on screen. Now the city says it first, the panel draws the rest the way the map draws it, and the words that are left are one short line. Nothing was deleted: every sentence is still on the page, as a picture's label for a screen reader and one tap away for anyone.

- **The level, on the map.** After a call, the typical lot's height around the called one is drawn over its block as a pale level (paper at 60%, 110 m across, with a hole where the lot stands so it keeps its truffle brown), tagged on its rim ("$5.8M typical"). Lots that stand through it are worth more per acre than the typical one around; lots under it, less; the called lot rises through it or stops under it. It fades in once the lot has risen, the way a stock chart draws the last close as a dotted line the price sits above or below. Reduced motion: it is there at once. It goes with the next lot.
- **The answer, drawn.** The panel draws the lot beside the typical lot around it as two tiles seen from the front with a sliver of lid, the way a skyline is drawn: height is value per acre with the map's own formula, width is the side of each lot's ground to scale, the typical one wears the use most lots around it have (or the plain gray when they're a mix), and a dashed line runs at its height. A big lot worth less stands wide and low. Under each tile, its number and its acres. The reason is one short line ("Bigger lot, value spread thin.", "Mostly homes around it.", "The records don’t say why."), and the full sentence opens under it with a tap, as The Pudding sets a "Text description" under a graphic.
- **The record as tiles.** One small tile per call, the latest ten in order, truffle when called right and an empty outline when not, beside "4 of 6", the way a daily game's share is a row of squares.
- **Copied, said by the button.** Send to a friend turns to "Copied" with a check; the longer sentence is read to a screen reader.
- **A lot's reasons as pictures.** The rank is pinned on the skyline ("Beats 71%"); the land against the building is one bar ("Land 92%", "House $112K"); the 10-minute walk is a dot on a track against the typical lot's reach; the rule is its color and its name. No fact tiles, no boxes. The four sentences sit under "In words".
- **Names on the map.** Rules writes each big zoning family's name (20 lots or more downtown) on its densest block in a pill of its own color, the way a zoning map writes the district on the district and a chart labels its lines at their ends instead of keeping a legend. Changing names the land the new lots stand on, with how many: "Johns West, 685 new lots" and "The old municipal golf course, 556 new lots", set beside each place so the lots stay in view. Both come from the records (`lib/marks.ts`), so they move when a pull does.
- **Keys drawn as tiles.** Value's key is the use colors as small tiles with one word each and a row of tiles rising from "$1M" to "$15M an acre". Changing's adds a flat tile, "Before 2023". Rules lists each family with its color, its name and a bar of how many lots downtown it covers.
- **Sources fold.** Several sources fold under one line that keeps their days, "Sources, pulled Nov 2 to 4, 2026".

Words a visitor reads on the first screen, the live site against this build (the most of phone and desktop):

| Screen | Before | After |
|---|---|---|
| A lot | 105 | 49 |
| Rules | 91 | 51 |
| Changing | 88 | 39 |
| The answer, sent | 76 | 48 |
| The answer | 70 | 51 |
| Value | 74 | 40 |
| A lot in Rules | 66 | 34 |
| `/brand`, the whole page | 622 | 500 |

## States

Plain words, per the voice rules:

| State | What it says |
|---|---|
| Looking up a lot | Looking up this lot… |
| A lot with no record | No record yet. We have no record for this lot yet. It may be newer than our last pull. |
| An address that isn't covered | That address isn’t covered yet. Truffle has Palm Beach County lots on record. (Without the database: Truffle has Downtown Boca Raton and West Boca so far.) |
| Search not answering | Search isn’t answering right now. Try again in a moment. |
| The map can't load | The map didn’t load on this device. The numbers still work: search an address above. |
| A link to a lot that doesn't exist | We have no record of that lot. The link may be from an older pull, or the address isn’t covered yet. |
| Any other address that isn't a page | There’s no page here. The link may be mistyped or out of date. The map is one tap away. |
| A lot the county puts no value on | Not valued, and its rows sit under "What the records say", not "Why it’s worth this". |

## Accessibility

- `lang="en"`, a viewport meta tag, visible 2 px truffle focus rings.
- The view tabs are a real tablist; the panel body is the tab panel and the only live region.
- Search is the ARIA combobox pattern: arrow keys, Enter, Escape, Home and End.
- Keyboard access to lots: "Lots on screen", a list of up to 40 visible lots reached with Tab, shown as a card when it has focus. Enter picks a lot exactly as a tap does. On the front door it names each lot without its value until the lot under fog has been called, the way the numbers on tiles wait for the answer: a screen reader reads the whole list, so a value in it would give the call away. After the call each row carries its value again.
- Every control is at least 24 by 24 px. Checked at 320, 375, 768, 1024 and 1440 px by `npm run qa`, with axe.

## Voice

The sharp local who explains things simply. Plain English, contractions, no jargon, no exclamation points, no em or en dashes, no slogans. Every number shows its source and pull date. Never call a neighborhood good or bad. Never name the tools used to make it.

| Say | Not |
|---|---|
| The land is 92% of the value. | This parcel exhibits a high land to improvement ratio. |
| The typical lot here reaches 14 km of street. | Walkability score 8.2/10 |
| We have no sale on record for this lot. | Oops! No data found. |
