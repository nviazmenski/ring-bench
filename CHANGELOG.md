# RingBench release history

Newest first. Each section describes the release it names; behaviour in older sections may since have changed. Current behaviour is in [README.md](README.md) and [MODEL.md](MODEL.md). Git tags `lite-X.Y` and `pro-X.Y` mark each release.

## Pro 4.10 / Lite 3.7 — analysis floor

- **Strike sounds no longer pose as the coin.** A striker that rings for about 100 ms at 200–300 Hz repeated across taps, became the lowest repeatable tone and failed genuine coins. The detector now ignores tones below a floor derived for each coin: the lowest band among the genuine coin and its modelled fakes, divided by the largest second-to-lowest mode ratio (1.72–1.87) and less the 2% edge guard. Anything hidden by the floor still shows its next mode below every band, so the floor cannot produce a PASS.
- **4 Ducats kept.** Their bands start at 662 and 696 Hz; their floors are 347 and 365 Hz. The Morgan's floor is 766 Hz, set by a lead–tin casting rather than the genuine band. New catalogue entries and constructions get a floor automatically, and a test checks the guarantee for every entry.
- **Visible, not scored.** Tones above the room noise but under the floor are listed for each tap as "Below analysis floor" in the evidence and shaded on Pro's spectrum. The floor limits the peak search, not the audio, so no filter ringing is introduced.
- A loud thud also no longer sets the detector's −42 dB peak threshold or its prominence reference.
- Detector `resolved-peaks-v3`. Each tap's settings and measurement exports record `analysisFloorHz`. Saved recordings keep the detector that measured them.
- The model notes no longer say layered construction is unmodelled; the clad presets have used an equivalent layered plate since 4.9.
- The verdict rules and bands are unchanged.

## Pro 4.9 / Lite 3.6 — fakes the pitch can rule out

- **Counterfeit construction screen**, in both editions. For gold and silver coins, a new card lists fakes made to the coin's weight and diameter:
  - plated tungsten (gold) or molybdenum (silver);
  - a tungsten or molybdenum core in a gold or silver shell;
  - underfine metal (5 points less, balance copper);
  - brass and copper, plus nickel silver, zinc alloy, lead–tin and steel for silver.

  Before a test it shows which ones the pitch separates from a genuine coin and by how much. After a complete test it says which ones the lowest repeatable tone rules out. For shells, it gives the shell thicknesses that remain possible. A full-weight brass Krugerrand is flagged as about twice as thick instead of being modelled. Measurement exports include the screen.
- **Layered plates.** A symmetric laminate is reduced to an equivalent homogeneous plate with the same bending stiffness and mass per area. The US clad presets use it: cupronickel clad E 125 → 137.6 GPa (band about +5%); 40% silver clad 98 → 94.8 GPa.
- **Materials.** New presets with handbook ranges: tungsten, molybdenum, copper, nickel silver, zinc alloy and lead–tin. Brass and steel gained ranges; brass density was 8.23 g/cm³ from the mixture rule and is now 8.39–8.75.
- **Solver.** Cyclic Jacobi replaces largest-pivot Jacobi: same eigenvalues to 10⁻¹², about four times faster.
- The verdict rules are unchanged.

## Pro 4.8 / Lite 3.5 — complete tests only, firm Lite result

- **No result before the last tap.** Lite needs two taps and Pro three. Until then both editions show measurements only: no verdict, band position or model fit. Keeping a reading early does not change that.
- **Lite answers PASS or NO PASS.** PASS means the lowest repeatable pitch is safely inside the expected range for the catalogue coin. Everything else is NO PASS: below or above the range, too close to an edge, or taps that did not repeat. Lite uses catalogue weight, diameter and alloy only. PASS remains an acoustic screen; confirm weight, diameter and metal independently.
- **Pro above the band.** When the lowest repeatable tone is above the lowest-mode band, Pro reports **Lower mode not established** only if the recurring tones fit the model as upper modes with the lowest mode missing. A lone high tone, a tone stranded between modeled modes, or a pattern that does not fit is **Primary frequency outside model**. This restores the stranded-tone exclusion that 4.6 dropped.
- **Model consistent** also requires the three-mode fit to include the lowest repeatable resonance.
- **Harmonic candidates.** A tone within 0.8% of 2–5× a lower tone is still excluded from scoring. The joint fit may count it as a plate mode above its parent tone only when no three-mode fit exists without it, and the verdict says so. On a flat silver plate the (1,1) mode sits about 4.01× above (2,0).
- **Spectrum marker.** Pro's blue marker shows the same lowest repeatable resonance as the headline figure.
- **Catalogue, 105 entries.** 2 Dinara is split into 1879/1897 (27 mm) and 1904–1915 (28 mm). British Crown through Sixpence are split by metal: sterling to 1919, .500 silver 1920–1946, cupronickel from 1947. Krugerrand and Sovereigns use 22k gold–copper; the silver-bearing preset is labelled as the American Gold Eagle alloy. The .9661 Au preset is removed; Yugoslav ducats remain .986.
- **Saved data.** References and specimens recorded under a split or removed catalogue entry are kept and exported, never deleted. Krugerrand and Sovereign references saved under the old preset are relabelled.
- Unused legacy detector and reference functions were removed. `RULES` keeps its fields for export compatibility.

For hosting, build into `dist` (`node scripts/build.mjs lite dist` or `node scripts/build.mjs pro dist`); `.openai/hosting.json` publishes that directory.

## Pro 4.7 — spectrum guides

Pro 4.7 (September 24) added green model guides and a blue measured marker to the Pro spectrum; it was a presentation change. Lite stayed at 3.4.

## Pro 4.6 / Lite 3.4 — field-first acoustic screen

The field candidate is now the lowest non-harmonic resonance family that repeats across taps, selected from measured frequencies before looking at the model. The loudest tone remains visible separately. Lite reports **Primary frequency checks out** when the candidate is safely within the provisional lowest-mode band, even if upper modes do not jointly fit. It explicitly recommends measuring mass and diameter and verifying metal independently (for example, with a Sigma). One tap stays provisional.

Pro puts the lowest-frequency band result first and retains three jointly fitted independent modes as the additional condition for **Model consistent**. When upper modes fail that stricter test, Pro says **Primary frequency in band** and explains how many modes fit without treating a missing upper mode as coin failure. If even the lowest retained tone is above the lowest-mode band, both editions report that a lower tone may have been missed and prompt a different strike position. A repeatable tone below the band remains an outside-model finding. This does not widen tolerances or establish authenticity; the current geometry family and catalogue dimensions remain assumptions. Historic revision notes below describe earlier behavior.

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
