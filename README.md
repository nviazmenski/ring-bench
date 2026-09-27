# RingBench

RingBench screens coins by their ring. Tap a coin, and it compares the lowest repeatable resonance with what a plate model predicts from the coin's weight, diameter and alloy. It is an acoustic screen, not an assay or an authentication: a pass means the pitch is consistent with the catalogue coin under stated assumptions.

This repository holds both editions. They share the detector, the catalogue and the physical model; each edition only chooses its workflow.

| Edition | Current release | Taps | Result |
|---|---|---|---|
| **Lite** | 3.10 | 2 | **PASS** / **NO PASS** on the lowest repeatable pitch, using catalogue weight, diameter and alloy |
| **Pro** | 4.13 | 3 | Field result plus a joint fit of two or more modes, evidence tables, recordings, reference specimens and model controls; an experimental 3D solid model for every coin |

Neither edition gives any result until every required tap is recorded.

**Experimental: 3D solid model (Pro).** The thin-plate model overpredicts thick coins, more for higher modes: about 2% on the lowest mode of a Morgan, 4% on (3,0) and 7% on (4,0). Pro can instead use a 3D elastic model of the coin's cross-section: die basin, relief, inner border and rim, with the rim thickness from your calipers. The Morgan has its own cross-section family; every other coin uses a generic one. With that model selected it also scores split tone pairs at their centroid and skips modes a centre support damps. It searches the first 100 ms of each tap for fast-decaying upper modes. It is opt-in, applies to the fakes in the construction screen too, and has been tested on seven coins their owner reports as genuine, read from screenshots; one of them, a Morgan (M06), also has recordings. See [MODEL.md](MODEL.md), "3D solid model" and "Two-mode rule".

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
  pro/solid.js        experimental axisymmetric 3D elastic solver, coin cross-sections and table lookup (Pro only)
  pro/solid-tables.js generated eigenvalue tables for the Morgan and generic cross-sections (do not edit)
tests/           node:test suites (synthetic audio, model, verdicts, release hygiene; a real Morgan recording in fixtures/)
scripts/         build.mjs (stage an edition), serve.mjs (local server), solid-tables.mjs (generate or check the solid tables)
research/solid/  Python validation and research scripts behind MODEL.md's "3D solid model" (not used by the app)
hosting/         per-edition hosting project configuration
retired-site/    retirement page prepared for the old single-file app on GitHub Pages (never deployed)
index.html       launcher for both editions (local, and the GitHub Pages landing page)
```

Until September 26, 2026, Lite and Pro lived in two repositories that each carried both editions. They were merged here with both histories intact. Tags `lite-X.Y` and `pro-X.Y` mark every release from Lite 3.1 and Pro 4.3 on; before the merge, the `lite-` tags are on the Lite repository's history and the `pro-` tags on Pro's.

## Development

No dependency installation is required. With Node 20 or later:

```
npm test            # all suites
npm run serve       # http://localhost:8080/ — Lite at /lite/, Pro at /pro/
npm run build       # stage dist-lite/ and dist-pro/
npm run solid:check # recompute sample entries of pro/solid-tables.js from the solver
npm run solid:tables # regenerate pro/solid-tables.js (about an hour on 4 cores)
```

Microphones need localhost or HTTPS, so use `npm run serve` for live taps; pages opened from disk can still load recordings. Edit the source here, never a staged copy.

**Releasing.** Bump the edition's build identifier in its entrypoint (`lite/lite.js` or `pro/pro.js`) and its `sw.js` `VERSION` together; `tests/release.test.cjs` fails if they differ or if the offline cache misses a file the page loads. A change to `shared/` affects both editions, so bump both. Add a CHANGELOG entry, tag the release commit (`lite-X.Y`, `pro-X.Y`) and push the tags by name (`git push origin lite-X.Y pro-X.Y`): a plain `git push` does not send tags.

**Deploying.** Each edition has its own hosting project (`hosting/lite.json`, `hosting/pro.json`), and both publish the `dist/` directory. `npm run stage:lite` or `npm run stage:pro` builds that edition into `dist/` and points the untracked `.openai/hosting.json` at its project; then publish. Stage and publish one edition at a time. Current private sites: [Lite](https://ringbench-lite.ds5kyf92rk.chatgpt.site) · [Pro](https://ringbench-pro.ds5kyf92rk.chatgpt.site).

**GitHub Pages.** The repository is public, and GitHub Pages republishes the root of `main` after every push, so the current editions are public at [nviazmenski.github.io/ring-bench](https://nviazmenski.github.io/ring-bench/): the launcher at the root, Lite at `lite/` and Pro at `pro/`. Unlike the private sites, they need no sign-in. Browser storage is per site, so references and recordings saved there don't appear on the private sites. To stop publishing, turn Pages off in the repository settings.

**Old deployments.** The `bubbling-goulash` sites predate these releases and may still serve old verdict logic. The Pages address used to serve the original single-file app. `retired-site/` holds a page and service worker written to retire it. They were never deployed, because GitHub rejected the repository write at the time. Nothing has replaced that app's service worker, so a browser that installed it may still show it. The retirement page also links to the `bubbling-goulash` sites rather than the current ones.

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
