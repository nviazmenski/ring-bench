# RingBench Lite and RingBench Pro — geometry-family edition

## Pro 4.5 / Lite 3.3 — primary resonance accounting

The verdict now identifies the primary acoustic family from the strongest recurring measured component before comparing it with theory. When that family falls in the expected lowest-mode band, an unexplained weaker family no longer turns the whole observation into **Outside model**. Pro reports **Primary resonance consistent** and keeps the secondary pattern unresolved; Lite reports **Within model band** and retains the extra tones as visible evidence. A primary family outside every modeled envelope can still produce **Outside model**. This changes evidence accounting, not detector tolerances or the theoretical geometry family.

The independently verified Serbian 1 Dinar observation at 6468.8 / 6521.9 Hz with a recurring 14669.5 Hz secondary family is included as a verdict regression. It confirms that intact primary-frequency evidence survives an unmodeled upper resonance; it is not bundled as a population reference or used to widen the model.

## Pro 4.4 / Lite 3.2 — resolved acoustic evidence

The shared detector now uses a low-sidelobe Blackman–Harris window. Neighboring peaks are retained only when separated by at least four inverse-record-duration units and a 6 dB spectral valley. The former 1.2% frequency-spacing suppression is removed. Zero padding does not imply extra physical resolution. These remain engineering detection heuristics, not calibrated error bars.

Close lines use longer, separate persistence windows and neighborhood-bounded checks. Recurrence matching keeps the 1% maximum but further limits matching by 45% of the nearest neighboring frequency separation in each tap, preventing resolved doublets from swapping identities when their loudness changes or a component is missing. A possible split group can contribute at most one assignment to a joint fit. The 3% descriptive grouping limit and all material/geometry tolerances are unchanged; asymmetric geometry is still not modeled.

Pro now separates **Model consistent**, **Insufficient independent modes**, **Model fit unresolved**, **Inconclusive**, and **Outside model**. An unresolved or insufficient observation is never titled “Inconsistent.” Lite reports **Within model band**, **Inconclusive**, or **Outside model** and explains that it is a pitch screen, not a three-mode material assessment. All-tap recurring evidence remains the scoring input; other per-tap peaks are visible separately, not silently counted as corroborated modes. The Evidence view explains shared mode envelopes and lists peaks for every tap.

Measurement export format 5 includes the detector identifier. Previously saved recordings and references remain unchanged; an earlier-detector notice explains when to re-record or reload WAVs to obtain the improved peak detection. No device-local storage is deleted or promoted into verified ground truth.

Synthetic checks cover close doublets at 44.1/48/96 kHz, single-tone sidelobe rejection, duration-limited resolution, missing-neighbor identity, distinct-family assignments and verdict semantics. A local, opt-in regression also checks the supplied unverified rouble WAVs; it does not bundle recordings or treat the specimen as authenticated. Run it with `RINGBENCH_SAMPLE_DIR=/path/to/recordings node --test tests/*.test.cjs`.

Current private sites: [Pro](https://ringbench-pro.ds5kyf92rk.chatgpt.site) · [Lite](https://ringbench-lite.ds5kyf92rk.chatgpt.site).

The sections below document earlier revisions and historical deployments.

[RingBench Lite](https://ringbench-lite.bubbling-goulash.chatgpt.site) offers a quick ping check with a provisional compatibility band and Compatible / Inconclusive / Anomalous outcomes. [RingBench Pro](https://ringbench-pro.bubbling-goulash.chatgpt.site) adds recurring-peak fitting across centre/rim geometries, separate material and geometry results, recordings and reference specimens. Its field-facing verdicts are Consistent / Inconsistent / Anomalous; the accompanying text states the narrower acoustic interpretation.

Open in Safari to add either app to the Home Screen. These Sites deployments retain owner-only access. The source contains a retirement page prepared for the old GitHub Pages address, but GitHub rejected repository writes: the old site has NOT been retired or unpublished by this update.

## Revision 4

Pro now treats the repeatable acoustic pattern as the primary observation. It tracks peaks recurring within 1% across every accepted tap and preserves every tap frequency, normalized within-tap level and short-window persistence change. Tracks separated by at most 3% are displayed as a possible split modal family; this is a conservative descriptive grouping, not a validated physical splitting limit and not an acceptance criterion. Larger separations remain distinct modal families.

For negative evidence, each theoretical mode has its own frequency envelope across every admitted geometry and uncertainty combination. A family repeated across the taps is acoustically anomalous when it lies more than 1% outside every envelope. This catches persistent tones stranded between modeled modes without inventing a fundamental or treating the result as proof of composition.

Near-integer 2×–5× components within 0.8% of a lower persistent family are retained and labelled as possible harmonics, but excluded from both joint plate-mode fitting and negative envelope scoring. A microphone, contact or strike nonlinearity can generate them; they are not independent authentication evidence.

The app compares ratios between modal families with the plate family, but ratio similarity alone is insufficient. A theoretical material-compatible result requires at least three one-to-one modal assignments whose ratios and absolute frequencies share a physically allowed scale. A single in-band tone or an unresolved two-tone pattern is reported as acoustic evidence rather than positive compatibility. A repeatable gross frequency anomaly can still serve as exclusion evidence.

Q remains diagnostic. The fingerprint records a simpler early/late spectral-level change for each persistent track, but does not use it in the compatibility decision. Relative peak levels are normalized within each tap and remain descriptive because strike position, support and microphone processing affect them.

Reference format 3 can preserve an independently verified modal fingerprint even when no unique fundamental is assigned. This prepares specimen collections for future empirical distributions over modal frequencies, ratios, splitting and repeatability. The current app does not infer a genuine-coin population from a small collection.

## Revision 3.1

Both editions preserve the 94-entry catalogue, styling and capture improvements. The main number is now an estimated fundamental, with the loudest resonance shown separately. Acquisition retains measured peaks without selecting them for agreement with theory. Repeated multi-peak recordings are interpreted across the geometry family, testing every recurring peak as a possible lowest observed mode. The interpretation is model-dependent: competing identities or a potentially missing lower mode leave the fundamental unresolved. One isolated credible tone remains an explicitly provisional candidate. The app does not blindly select the lowest FFT peak. Lite compares the candidate with the provisional geometry-family band; edge cases are inconclusive and an anomaly requires a repeat.

New saved references label their selected fundamental explicitly. Older references remain preserved but are not silently reinterpreted as fundamentals. Q remains associated with the loudest resonance actually used for the decay fit.

Pro models a thinner centre and raised annular rim with a Rayleigh–Ritz plate solver. At least three distinct recurring peaks are required for material compatibility. One-to-one assignments compare absolute frequencies and ratios, allowing a common scale only within the stated nuisance bounds. The interface reports assigned/observed peak counts, residuals, surviving geometries and other material hypotheses. Material compatibility is not composition identification.

The old uniform-plate cubic remains for numerical regression and the synthesizer's decay/amplitude helper; screening and joint fitting use the new family. Playback uses an illustrative family member.

See [MODEL.md](MODEL.md) for the derivation, parameter ranges, provisional thresholds, convergence checks and limitations. The band spans sampled assumptions; it is not a statistical confidence interval. Relief, anisotropy, support-induced frequency shifts, shear effects and layered construction remain unresolved.

## Reference collection

The collection accepts several physical specimens per type, each with a stable ID, independent verification method and notes. It reports observed specimen-level statistics without treating a small sample as a calibrated population. No known-good specimens are bundled. Synthetic tests do not populate the real collection.

Reusing an ID updates that specimen. Identical tap timestamps cannot count again under another ID. Existing single references remain compatible; they are not automatically promoted into independently verified specimens.

Export all references includes the single references and specimen collection. Import validates and merges records after provenance confirmation. These are device-local data; different site origins do not share browser storage. Use exports to transfer between Lite and Pro and keep backups before clearing browser data.

## Source and build

The shared catalogue is in shared/coins.js; the legacy model in shared/model.js; the new solver, bands and fits in shared/geometry.js; signal processing in shared/acoustics.js; references in shared/references.js; and the controller in shared/app.js. Each edition has its own page, entrypoint, manifest and scoped offline worker.

No dependency installation is required. With Node 18+:

```
node --test tests/*.test.cjs
node scripts/build.mjs lite dist-lite
node scripts/build.mjs pro dist-pro
```

Serve source routes /lite/ and /pro/ on localhost, or the standalone output over HTTPS. Microphones require localhost or HTTPS. Edit shared source rather than generated deployment copies. Bump the entrypoint and service-worker release identifiers together. Offline caches include the geometry module.

## Capture and recordings

The app calibrates the room for 600 ms before Ready. Short-frame onset detection compares the sound with the learned room and recent sound. Clipping confined to the first 20 ms of impact can be omitted with a recovery margin; distorted ringing still fails. Persistent tones must survive separate windows, and flat switched-on tones need an actual impulse or falling ring. Valid Q remains optional. These are provisional acquisition heuristics.

Pro saves actual PCM and metadata to device-local IndexedDB. Export WAV per tap and measurement JSON to preserve readings externally. Version 4 measurement exports include the geometry assumptions, screening result, Pro fit and acoustic fingerprint. Existing recordings can be re-evaluated under the current family.

## Verification limits

Tests cover the uniform-plate limit, mass conservation, convergence indication, scaling, band boundaries, multiple-peak fitting, insufficient evidence, distinct assignments, missing lower modes, specimen deduplication and the complete synthetic audio-to-Pro-fit path. Capture, migration, stale asynchronous results and WAV regressions remain. The previous Lite fixture is test-only.

These checks establish numerical consistency and implementation behaviour, not field sensitivity or specificity. The next empirical task is collecting independently checked specimens across coin types, wear and devices, followed by held-out calibration.
