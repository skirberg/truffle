# Truffle colors

Color means use. Height means value. Truffle brown means the lot you picked, and nothing else on the map is that color. The use colors come from the Sanborn fire insurance maps; each has a left and a right side a step darker (`brand/tokens.json`), which the light makes on the map.

CMYK is an approximation from RGB with no print profile behind it. Proof it before anything is printed.

| Name | Token | Role | HEX | RGB | CMYK (approximate) |
|---|---|---|---|---|---|
| Paper | `paper` | Ground of every screen, and the streets between tiles | #F2EDE3 | 242, 237, 227 | 0, 2, 6, 5 |
| Card | `card` | Panels, the phone sheet, pills on the map | #FBF8F2 | 251, 248, 242 | 0, 1, 4, 2 |
| Truffle | `truffle` | Type, and the lot you picked | #2A1E17 | 42, 30, 23 | 0, 29, 45, 84 |
| Truffle side | `truffleSide` | Side of the picked tile in pictures | #4A3A2F | 74, 58, 47 | 0, 22, 36, 71 |
| Soft | `soft` | Secondary text | #6E6658 | 110, 102, 88 | 0, 7, 20, 57 |
| Faint | `faint` | Source lines and placeholders | #736B5D | 115, 107, 93 | 0, 7, 19, 55 |
| Line | `line` | Hairlines, and the lot under fog | #DDD5C6 | 221, 213, 198 | 0, 4, 10, 13 |
| Water | `water` | Rivers, lakes and the sea. Not a use | #C1CFDF | 193, 207, 223 | 13, 7, 0, 13 |
| Homes | `use.homes` | Sanborn yellow: single family, condos, apartments | #F4C542 | 244, 197, 66 | 0, 19, 73, 4 |
| Shops and offices | `use.biz` | Sanborn pink: stores, offices, restaurants, hotels | #EE8577 | 238, 133, 119 | 0, 44, 50, 7 |
| Civic and parks | `use.civic` | Sanborn blue: parks, schools, churches, public land | #86ABDB | 134, 171, 219 | 39, 22, 0, 14 |
| Vacant | `use.vacant` | Empty land | #E4DED1 | 228, 222, 209 | 0, 3, 8, 11 |
| Other | `use.other` | Anything else | #D6CFC0 | 214, 207, 192 | 0, 3, 10, 16 |

## Contrast

Every text and color pair the product uses, with its WCAG ratio and the least it must reach (`npm run contrast`).

| Pair | Colors | Ratio | Needs |
|---|---|---|---|
| Body and titles on the panel | #2A1E17 on #FBF8F2 | 15.28:1 | 4.5:1 |
| Body on paper | #2A1E17 on #F2EDE3 | 13.88:1 | 4.5:1 |
| Secondary text on the panel | #6E6658 on #FBF8F2 | 5.35:1 | 4.5:1 |
| Secondary text on paper | #6E6658 on #F2EDE3 | 4.86:1 | 4.5:1 |
| Source line on the panel | #736B5D on #FBF8F2 | 4.97:1 | 4.5:1 |
| Search placeholder on the search field | #736B5D on #F2EDE3 | 4.51:1 | 4.5:1 |
| Active tab | #F2EDE3 on #2A1E17 | 13.88:1 | 4.5:1 |
| Inactive tab | #6E6658 on #FBF8F2 | 5.35:1 | 4.5:1 |
| Picked lot number on its pill | #F2EDE3 on #2A1E17 | 13.88:1 | 4.5:1 |
| Tile number on its pill over homes | #2A1E17 on #faf4e4 | 14.75:1 | 4.5:1 |
| Tile number on its pill over biz | #2A1E17 on #faefe8 | 14.33:1 | 4.5:1 |
| Tile number on its pill over civic | #2A1E17 on #f2f2f0 | 14.45:1 | 4.5:1 |
| Tile number on its pill over vacant | #2A1E17 on #f9f6ef | 15.01:1 | 4.5:1 |
| Tile number on its pill over other | #2A1E17 on #f8f5ee | 14.88:1 | 4.5:1 |
| Tile number on its pill over water | #2A1E17 on #f6f5f0 | 14.84:1 | 4.5:1 |
| Map credit over water | #6E6658 on #f5f4f0 | 5.15:1 | 4.5:1 |
| Zoning family name on its own color, single | #2A1E17 on #F4C542 | 9.96:1 | 4.5:1 |
| Zoning family name on its own color, duplex | #2A1E17 on #E9B53A | 8.59:1 | 4.5:1 |
| Zoning family name on its own color, apartments | #2A1E17 on #D9A02A | 6.95:1 | 4.5:1 |
| Zoning family name on its own color, downtown | #2A1E17 on #EE8577 | 6.37:1 | 4.5:1 |
| Zoning family name on its own color, shops | #2A1E17 on #D96A5B | 4.75:1 | 4.5:1 |
| Zoning family name on its own color, public | #2A1E17 on #86ABDB | 6.83:1 | 4.5:1 |
| Zoning family name on its own color, special | #2A1E17 on #D6CFC0 | 10.45:1 | 4.5:1 |
| Map credit over homes | #6E6658 on #faf3e0 | 5.12:1 | 4.5:1 |
| Map credit over biz | #6E6658 on #faede6 | 4.95:1 | 4.5:1 |
| Map credit over civic | #6E6658 on #eff0f0 | 4.96:1 | 4.5:1 |
| Map credit over vacant | #6E6658 on #f9f5ef | 5.22:1 | 4.5:1 |
| Map credit over other | #6E6658 on #f7f4ed | 5.16:1 | 4.5:1 |
| Focus ring against paper (non-text) | #2A1E17 on #F2EDE3 | 13.88:1 | 3:1 |
| Focus ring against the panel (non-text) | #2A1E17 on #FBF8F2 | 15.28:1 | 3:1 |
| Picked lot against homes yellow (non-text) | #2A1E17 on #F4C542 | 9.96:1 | 3:1 |
| Picked lot against shops pink (non-text) | #2A1E17 on #EE8577 | 6.37:1 | 3:1 |
| Picked lot against civic blue (non-text) | #2A1E17 on #86ABDB | 6.83:1 | 3:1 |
| Picked lot against vacant gray (non-text) | #2A1E17 on #E4DED1 | 12.08:1 | 3:1 |
| Picked lot against water (non-text) | #2A1E17 on #C1CFDF | 10.23:1 | 3:1 |
