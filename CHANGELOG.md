# Changelog

What a visitor gets on truffle.city, newest first.

## Nov 22, 2026

- **How it’s built**, at `/built`: the county’s outlines turning into tiles, one lot from its record to its tile, the height scale, the stack and why each piece was chosen, every source with the day it was pulled, how it’s checked and what it never asks for. Linked from the map’s panel and the brand kit, with its own share card.
- **A link to a lot that isn’t on record previews honestly.** It used to show a tile and "Not valued" for a lot that isn’t there; now its card says "We have no record of that lot", as the page does. A friend’s link to a lot that can’t be called does the same.
- **A sharper home-screen icon on Android**: the full-bleed icon now comes at 192 px as well as 512.
- **Next lot never stalls.** Calling a lot before the camera had landed could leave Next lot with nothing to offer. It now waits for the map to settle and finds the next lot.
- **More contrast when you ask for it.** If your phone or computer is set to increase contrast, secondary words and source lines turn darker (from about 5:1 to about 10:1). With Windows high contrast, the view you're on, the buttons and the marks in every picture stay visible.
- **Cleaner lines of text.** Headings break into even lines, and no paragraph ends on one word alone.
- **One title size for a lot**, wherever it shows: 28 px, 24 on a phone.
- **A lighter page font**: 13 KB less on every visit, with nothing you read missing.
- **The brand kit's tokens in the W3C format** (`/brand/colors/truffle.tokens.json`): the colors and what each one does, type, spacing, shadows and motion, for design tools and AI assistants.
- **Every change is checked before it ships**: each pull request runs the full set of checks.

## Nov 20, 2026

- **Show, don't tell.** The panels say about half as much and draw the rest. After a call the map lays the typical lot's height over the block as a pale level, so you see whether the lot stands above or below its neighbors; the panel draws the lot beside the typical one, wide and low or narrow and tall, with the reason in a few words and the full sentence a tap away. A lot's reasons are pictures (its rank pinned on its skyline, land against building as one bar, the walk on a track), Rules writes the zoning families on the map in their own colors, Changing names the land the new lots stand on with how many, the record is a row of tiles, and several sources fold under one line with their days.
- **A new lot every day.** The front door opens on the day's lot, the same for everyone that day, numbered from Nov 20, 2026 ("Lot No. 1"). Come back the same day and it opens answered; the next day there's a new one. The rounds after it go on as before.
- **Your record, kept.** "4 of 6 called right" carries over between visits, in this browser only.
- **Send a lot to a friend.** After a call, Send to a friend opens the phone's share sheet (or copies on a computer) with a line to paste, "Truffle No. 12: called it in Boca", and a link that opens the same lot under fog for them. Your call stays hidden until they make theirs; then they see "You said More, they said Less" and the answer.
- **A preview of the lot itself.** The link shows the lot under fog among its neighbors with the question, never the answer.
- **The city from the first frame.** The front door paints the lit city before the map is ready, instead of a second of empty paper.
- **The name, said once.** Under the first call: "A truffle is value hidden underground. You find it by searching."
- The brand kit at `/brand`, drawn on every build.
