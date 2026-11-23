# Contributing

Truffle gets better one fix at a time. The most useful help, in order:

1. **A wrong number or name.** Open a [Something is wrong](https://github.com/skirberg/truffle/issues/new?template=data.yml) issue with the lot, what it shows and what it should show. The values are the county's own records, so a source helps.
2. **Something broken.** A view that fails, a map that won't load, a button that does nothing: open a [Something is broken](https://github.com/skirberg/truffle/issues/new?template=bug.yml) issue with the page, your device and a screenshot.
3. **Code.** Small pull requests that fix one thing. For anything bigger, open an issue first.

## What this repo is

This is the app: the map, the game, the lot panel and the views. The data pipeline that pulls county records and builds the tiles is private, so this repo ships a small sample (businesses and public land around Downtown Boca Raton and West Boca) that runs with no keys.

Changes here are copied into the live site by hand, so a merged pull request can take a few days to show on truffle.city.

## Run it

```bash
npm ci
npm run dev
```

Node 24. No environment variables are needed for the sample.

## Before you open a pull request

```bash
npm run check
```

CI runs the same checks on every pull request.

## Privacy

Never add a list of home addresses with values, or anything that singles out a person or a household. Questions about a specific property go to the county property appraiser, not here.
