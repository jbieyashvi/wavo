# WAVO — scooty rental prototype

A clickable design concept for renting seated electric scooties by the hour, set in a fictional Indian neighbourhood (Sarovar Layout, Nilapur).

**Live prototype:** https://jbieyashvi.github.io/wavo/

Everything is simulated: there are no real payments, identity checks, backend or hardware unlocking, and no API keys are needed. Nothing here has been tested with real users.

Beside the phone there is an unfolded two-pane foldable (iPhone Duo concept) version of the first three screens. It is a layout exploration and has not been tested on a real device.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5180
npm run build
```

Checks: `npx tsc --noEmit`, `npx tsx scripts/state-guards.ts`, `npx tsx scripts/pricing-boundaries.ts`.

See `DESIGN_NOTES.md`, `SCREEN_INVENTORY.md` and `EDGE_CASE_AUDIT.md` for the design write-up.
