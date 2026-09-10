# Ring Bench

Static, offline-capable acoustic comparison of struck coins. No build step,
third-party runtime dependency, backend, or audio upload. Build:
`2026-09-10.reliability-1`.

A result describes acoustic agreement with a selected flat-disc model or a
compatible local reference. It does **not** determine fineness, authenticate a
coin, or prove that its interior is homogeneous. Alloy constants, damping and
acceptance tolerances still need empirical calibration.

## Files and deployment

| File | Purpose |
| --- | --- |
| `index.html` | Complete application: physics, UI, DSP and test workflow |
| `sw.js` | Scoped, versioned offline cache and update notifications |
| `ring-bench.html` | Redirect from the obsolete application to `index.html` |
| `manifest.json` | Existing home-screen installation metadata |
| `icon.svg` | Existing icon |
| `tests/*.test.cjs` | Dependency-free Node regression tests; never loaded by the app |
| `RELEASE_NOTES.md` | Update instructions, checks and limitations |

For an existing installation, replace **all three** runtime files together:
`index.html`, `sw.js`, and `ring-bench.html`. Keep `manifest.json` and `icon.svg`.
Include the README, release notes and tests in the repository for maintainers.
Deploy using the existing GitHub Pages branch/root settings. Nothing needs to
be compiled. Microphone use requires HTTPS (or localhost for development).

After deployment, open the app online and accept its reload banner. The footer
must show `2026-09-10.reliability-1`. Reopen if the previous service worker served
a cached page on the first visit. Wait for “cached for offline use” before going
offline. Bump `BUILD` in `index.html` and `VERSION` in `sw.js` together on future
releases. An older open page can finish a test before the user taps reload.

The cache name includes the app's URL scope. Activation removes only older
Ring Bench caches for that scope, not other applications' caches. The previous
unscoped `ringbench` cache is left alone rather than risking unrelated data;
the new worker does not use it. Background refresh uses `event.waitUntil()`.

## Field workflow

1. Select the coin. In Specs, enter weight and dimensions. The initial values
   are **catalogue values**; check the measurement boxes only for measurements
   you actually took. Choosing another coin clears rim correction, wear and
   measurement confirmations.
2. Use a consistent support position, microphone distance and strike method.
   “Start three-strike test” stops synthesized playback and opens the microphone.
   Audio processing is requested off; if the browser reports it enabled, use
   another input. A displayed sample rate is not proof of usable bandwidth.
3. Let the background settle, then make three strikes. Wait for each ring to
   finish before the next strike. Rejected captures do not count. The screen
   explicitly reports rejection and retains the count of accepted strikes.
4. Review the frozen median frequency, full spread, recurring distinct upper
   modes, capture checks and diagnostic Q. Start a fresh test for another coin.
   Changes to measurement/analysis settings cancel the current test.
5. Optionally export test JSON. It contains spectra, detected peaks, timing,
   fit diagnostics, source metadata and settings for each accepted strike.
   **It does not contain raw audio**; keep original recordings separately.

“Load a recording” accepts one strike per file (up to 25 MB and 30 seconds).
Provide at least 60 ms of quiet before the strike and half a second after it.
Load three different strike recordings for a result. Exact duplicate files,
including renamed duplicates, cannot count twice in the same test. Decoding
may resample files; original recording bandwidth remains unknown. Microphone
and imported-file tests are kept separate.

## Result rules (provisional)

| Check | Initial rule |
| --- | --- |
| Repeated measurements | 3 accepted strikes |
| Fundamental repeatability | Full frequency range / median ≤ 1% |
| Upper-mode evidence | At least 2 distinct modes matched in every strike, each with ≤1% frequency spread |
| Per-mode ratio matching | Relative error ≤ 5%; one-to-one assignment |
| Pitch against theory | ±8% |
| Pitch against compatible reference | ±1.5% |
| Peak above pre-strike background | At least 10 dB after window-length scaling |
| Clipping | Reject 3 or more samples with absolute amplitude ≥ 0.995 |
| Decay fit (Q reporting only) | At least 8 envelope points, R² ≥ 0.90 and ≥ 8 dB decline |
| Conservative analysis ceiling | Min(22 kHz, 0.45 × context rate, 0.45 × reported source rate) |

These thresholds are engineering safeguards, **not measured assay accuracy**.
Two missing upper modes, an ambiguous fundamental or inconsistent strikes
produce **Inconclusive**, even when the pitch matches. Repeatable pitch outside
tolerance, with adequate recurring modes, produces **Acoustic mismatch**. An
accepted match is **Acoustically consistent with the selected model**. There is
no confidence percentage or numerical authenticity score. Q is diagnostic only;
poor Q fits are excluded rather than penalizing the coin.

Wear allowance is a limited downward pitch tolerance for catalogue geometry.
It is ignored if the mass used to infer thickness, or the caliper thickness,
is confirmed measured. Mean thickness still does not fully represent relief,
raised rims, wear distribution or laminated construction.

## Alloy comparison and references

The illustrative A/B playback holds dimensions fixed and shows the mass implied
by the comparison alloy. It now uses that alloy's own Poisson ratio.

The result's alternative-alloy table instead evaluates **each** density
hypothesis against the entered mass and diameter, recomputing thickness per
candidate, or holds entered caliper thickness fixed in caliper mode. It searches
all built-in alloy families. This is only a ±8% theoretical pitch comparison;
it does not establish a candidate's actual composition or model plating/layers.

Saving a local reference requires three repeatable accepted strikes, measured
geometry confirmations, an explicit independently-trusted specimen check and
a provenance note. References include the build/model version, dimensions,
analysis settings, source/rate information, peak lists and repeatability.

Legacy references remain stored but are not used for the tighter pitch band.
A reference is used only when its build, model, settings and audio source match
exactly. This intentionally conservative first release does not normalize
references between different specimen dimensions, microphones or builds.
Changed conditions fall back to theory with a visible explanation. References
are local to the current device/browser; export evidence for a separate backup.

## Verification

Run with Node 18 or newer:

```sh
node --test tests/*.test.cjs
```

Tests execute the actual inline app in a minimal DOM adapter, its FFT/peak/mode
logic on synthetic signals, its session state transitions, and its service
worker against mocked cache/network APIs. They include asynchronous cancellation,
reference persistence failures, invalid inputs, noise/clipping rejection,
known exponential decay and offline refresh. They do not establish browser
microphone behavior or real-coin accuracy. Physical phone and coin validation
remains necessary.

The polynomial physics coefficients and alloy catalogue are unchanged by this
release. The separately supplied `eig.py` was not present in the repository at
base commit `219029133806aa29db9aa1349ccf5ff66ab4acc8`; this update does not add a
new derivation or resolve the source-table discrepancy noted in the review.
