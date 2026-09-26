# RingBench

RingBench screens coins by their ring. Tap a coin, and it compares the lowest repeatable resonance with what a plate model predicts from the coin's weight, diameter and alloy. It is an acoustic screen, not an assay or an authentication: a pass means the pitch is consistent with the catalogue coin under stated assumptions.

This repository holds both editions. They share the detector, the catalogue and the physical model; each edition only chooses its workflow.

| Edition | Current release | Taps | Result |
|---|---|---|---|
| **Lite** | 3.8 | 2 | **PASS** / **NO PASS** on the lowest repeatable pitch, using catalogue weight, diameter and alloy |
| **Pro** | 4.11 | 3 | Field result plus a joint multimode fit, evidence tables, recordings, reference specimens and model controls; an experimental 3D solid model for the Morgan dollar |

Neither edition gives any result until every required tap is recorded.

**Experimental: 3D solid model for the Morgan dollar (Pro).** The thin-plate model overpredicts thick coins, more for higher modes: about 2% on the lowest mode of a Morgan, 4% on (3,0) and 7% on (4,0). For the Morgan, Pro can instead use a 3D elastic model of its cross-section: die basin, relief, denticles and rim, with the rim thickness from your calipers. With that model selected it also scores split tone pairs at their centroid and skips modes a centre support damps. It searches the first 100 ms of each tap for fast-decaying upper modes. It is opt-in and tested on one recorded specimen so far; see [MODEL.md](MODEL.md), "3D solid model".

**Fakes the pitch can rule out.** For gold and silver coins, both editions also list specific counterfeit constructions made to the coin's weight and diameter: the fakes that pass a scale and calipers. The list covers plated tungsten or molybdenum, a tungsten or molybdenum core in a precious-metal shell, underfine metal and common base metals. Before a test it shows which of them the pitch can separate from a genuine coin, and by how much. After a complete test it says which ones this coin's lowest repeatable tone rules out, and which remain possible, such as underfine metal or a thick shell over a tungsten core. It is modelled from handbook material ranges, not yet validated against real fakes. [MODEL.md](MODEL.md) has the derivation, assumptions and limits; [CHANGELOG.md](CHANGELOG.md) has the release history.

## Repository layout

```
shared/          detector, catalogue, solver, references and controller used by both editions
  coins.js         catalogue (coins and alloy presets)
  model.js         legacy uniform plate (regression limit and playback)
  geometry.js      stepped-rim Rayleigh–Ritz solver, bands, joint fit and verdicts
  constructions.js counterfeit constructions: bands, separability and what a reading rules out
  acoustics.js     capture and peak detection
  references.js    saved references and specimen collection
  app.js           controller
lite/, pro/      each edition's page, entrypoint, manifest, icons and scoped offline worker
  pro/solid.js        experimental axisymmetric 3D elastic solver and the Morgan cross-section (Pro only)
  pro/solid-tables.js generated eigenvalue tables for the Morgan cross-sections (do not edit)
tests/           node:test suites (synthetic audio, model, verdicts, release hygiene; a real Morgan recording in fixtures/)
scripts/         build.mjs (stage an edition), serve.mjs (local server), solid-tables.mjs (generate or check the solid tables)
research/solid/  Python validation and research scripts behind MODEL.md's "3D solid model" (not used by the app)
hosting/         per-edition hosting project configuration
retired-site/    the retirement page prepared for the old GitHub Pages address
index.html       local launcher for both editions
```

Until September 26, 2026, Lite and Pro lived in two repositories that each carried both editions. They were merged here with both histories intact; tags `lite-3.1` … `lite-3.6` and `pro-4.3` … `pro-4.9` mark every release to that date; later releases are tagged the same way.

## Development

No dependency installation is required. With Node 20 or later:

```
npm test            # all suites
npm run serve       # http://localhost:8080/ — Lite at /lite/, Pro at /pro/
npm run build       # stage dist-lite/ and dist-pro/
npm run solid:check # recompute sample entries of pro/solid-tables.js from the solver
npm run solid:tables # regenerate pro/solid-tables.js (about 10 minutes on 4 cores)
```

Microphones need localhost or HTTPS, so use `npm run serve` for live taps; pages opened from disk can still load recordings. Edit the source here, never a staged copy.

**Releasing.** Bump the edition's build identifier in its entrypoint (`lite/lite.js` or `pro/pro.js`) and its `sw.js` `VERSION` together; `tests/release.test.cjs` fails if they differ or if the offline cache misses a file the page loads. A change to `shared/` affects both editions, so bump both. Add a CHANGELOG entry and tag the commit (`lite-X.Y`, `pro-X.Y`).

**Deploying.** Each edition has its own hosting project (`hosting/lite.json`, `hosting/pro.json`), and both publish the `dist/` directory. `npm run stage:lite` or `npm run stage:pro` builds that edition into `dist/` and points the untracked `.openai/hosting.json` at its project; then publish. Stage and publish one edition at a time. Current private sites: [Lite](https://ringbench-lite.ds5kyf92rk.chatgpt.site) · [Pro](https://ringbench-pro.ds5kyf92rk.chatgpt.site).

**Old deployments.** The GitHub Pages site and the `bubbling-goulash` sites predate these releases and may still serve old verdict logic. `retired-site/` holds the retirement page prepared for the GitHub Pages address; it was never published there because GitHub rejected the repository write.

## Reference collection

The collection accepts several physical specimens per type, each with a stable ID, independent verification method and notes. It reports observed specimen-level statistics without treating a small sample as a calibrated population. No known-good specimens are bundled. Synthetic tests do not populate the real collection.

Reusing an ID updates that specimen. Identical tap timestamps cannot count again under another ID. Existing single references remain compatible; they are not automatically promoted into independently verified specimens.

Export all references includes the single references and specimen collection. Import validates and merges records after provenance confirmation. These are device-local data; different site origins do not share browser storage. Use exports to transfer between Lite and Pro and keep backups before clearing browser data.

## Capture and recordings

The app calibrates the room for 600 ms before Ready. Short-frame onset detection compares the sound with the learned room and recent sound. Clipping confined to the first 20 ms of impact can be omitted with a recovery margin; distorted ringing still fails. Persistent tones must survive separate windows, and flat switched-on tones need an actual impulse or falling ring. Valid Q remains optional. These are provisional acquisition heuristics.

The detector ignores tones below an analysis floor derived for each coin from its model band and those of its modelled fakes, so the striker's own ring cannot pose as the coin's lowest tone. The floor keeps every modelled lowest mode, including the 4 Ducats' at about 660–850 Hz; tones under it stay visible as evidence and are never scored. [MODEL.md](MODEL.md) has the derivation and its guarantee.

Pro saves actual PCM and metadata to device-local IndexedDB. Export WAV per tap and measurement JSON to preserve readings externally. Version 4 measurement exports include the geometry assumptions, screening result, Pro fit and acoustic fingerprint. Existing recordings can be re-evaluated under the current family.

## Verification limits

Tests cover the uniform-plate limit, mass conservation, convergence indication, scaling, band boundaries, multiple-peak fitting, insufficient evidence, distinct assignments, missing lower modes, specimen deduplication and the complete synthetic audio-to-Pro-fit path. Capture, migration, stale asynchronous results and WAV regressions remain. The previous Lite fixture is test-only.

These checks establish numerical consistency and implementation behaviour, not field sensitivity or specificity. The next empirical task is collecting independently checked specimens across coin types, wear and devices, followed by held-out calibration.
