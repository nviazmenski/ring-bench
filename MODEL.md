# RingBench geometry family, revision 3

## Verdict rules — Pro 4.8 / Lite 3.5 (current)

This section is the current verdict logic; Pro 4.9 / Lite 3.6, Pro 4.10 / Lite 3.7 and Pro 4.11 / Lite 3.8 left it unchanged. Where any later section disagrees, including "Bands and fitting" and "Reference specimens", this section applies. The forward model, detector thresholds, 3% fit tolerance and band construction are unchanged. Pro 4.11 adds an optional experimental model for the Morgan dollar ("3D solid model"); the rules here apply to it too, with the changes that section lists.

**Tap count.** No result is given until the edition's full tap count is recorded: two for Lite, three for Pro. Before that, only measurements are shown.

**Lite.** The lowest repeatable non-harmonic family is compared with the guarded lowest-mode band for the catalogue coin. Strictly inside the guards is PASS. Anything else is NO PASS: below the band, above it, within a guard, or no tone repeating across both taps. Lite cannot tell a missed lowest mode from a coin that rings high, so it does not try.

**Pro, above the band.** A missed lowest mode stays open ("Lower mode not established") only when a supported identity fit anchors the lowest recurring family on a higher mode with the lowest mode unobserved, and that family lies inside a modeled envelope. Otherwise the result is outside the model. A lone tone above the band therefore cannot keep that possibility open.

**Pro, Model consistent.** In addition to the three-mode joint fit, an unambiguous lowest-mode estimate and no unexplained secondary family, the fitted lowest mode must lie in the lowest repeatable family.

**Harmonic candidates.** A family within 0.8% of a 2×–5× multiple of a lower family stays out of scoring and envelope exclusion. The joint fit may use it as an upper member alongside its parent family, and such fits count only when no three-mode fit exists without one. Plate-mode ratios can fall near integers by coincidence. For a uniform plate at ν = 0.37, (1,1)/(2,0) ≈ 4.010; the same happens for some stepped shapes of silver and gold. The verdict states when a fit relied on such a tone.

**Tracked modes.** The solver computes circumferential orders n = 0–4 and tracks (2,0), (0,1), (3,0), (1,1), (4,0) and (2,1). These are not the six lowest modes. On a uniform plate, (5,0) has λ² ≈ 31.6–33.6 for ν = 0.29–0.42, below (2,1) at ≈ 35.2. A real (5,0) peak is therefore reported as outside every modeled mode. Adding it is a separate model revision.

## 3D solid model — Pro 4.11–4.12 (experimental)

This section is current. It is opt-in, in Pro, for any catalogue coin: **Model → Plate model → 3D solid (experimental)**. The choice stays as you switch coins. The Morgan dollar uses its own cross-section family (4.11); every other coin uses the generic family (4.12). Lite and Pro's default thin-plate model are unchanged.

**Why.** The thin-plate (Kirchhoff) model leaves out transverse shear and rotary inertia. For a disc as thick as a Morgan (volume-equivalent thickness/radius 0.12) it overpredicts every mode, and more so for higher modes. A uniform disc at ν = 0.37 is overpredicted by:

| Mode | (2,0) | (0,1) | (3,0) | (1,1) | (4,0) | (2,1) |
|---|---|---|---|---|---|---|
| Thin plate / 3D | +2.1% | +2.2% | +4.4% | +5.5% | +7.0% | +9.4% |

The band absorbs the first column through its scale. The ratios do not: thin-plate (3,0)/(2,0) is 2.334 on a flat disc, the 3D value 2.284. This is the error that grows with frequency.

**Solver** (`pro/solid.js`). The model is 3D linear elasticity on the coin's cross-section, with no plate assumptions. Displacements are u_r = U cos nθ, u_θ = V sin nθ and u_z = W cos nθ. Each circumferential order n is solved on the half cross-section 0 ≤ z ≤ h(r)/2. Mid-plane antisymmetry keeps only the flexural family. The axis conditions are exact: for n = 0, U = 0; for n = 1, W = 0 and V = −U; for n ≥ 2, all three are zero. The discretisation uses biquadratic 9-node elements and 4×4 Gauss points, solved by banded Cholesky and subspace iteration. The iteration stops at a relative change of 10⁻⁹; thin discs make the stiffness matrix ill-conditioned, and a tighter test only chases rounding noise. Eigenvalues are reported as the plate-equivalent λ² in f = λ²·h̄/(2πa²)·√(E/(12(1−ν²)ρ)), so the rest of the app is unchanged.

**Validation.**
- **Thin limit.** At h/a = 0.005 all six tracked modes agree with the free Kirchhoff plate within 0.05%, for ν = 0.30 and 0.37.
- **Independent 3D check.** A spectral Ritz solution of the same elasticity problem shares no code with the solver: Legendre polynomials in r², exact axis regularity. Uniform discs at h/a = 0.12 and 0.24 agree within 10 ppm across seven modes.
- **Mesh.** The shipped mesh (30 elements per radius, three layers through the half thickness) agrees with a 60-element mesh within 4·10⁻⁵.
- **Port.** The JavaScript solver and the Python prototype give identical eigenvalues to four decimals on the Morgan cross-section.

The scripts are in `research/solid/`; `tests/solid.test.cjs` repeats the thin-limit and spectral checks.

**Cross-sections.** Both families are per side and mirror-symmetric, in units of the radius:
- **Field:** a spherical die basin of sagitta s, the field depth at the centre relative to the field edge.
- **Relief:** smeared, on a central device and on a legend band. The Morgan family fixes the legend band at 0.74–0.89 of the radius; the generic family places it from 0.04 outside the device to 0.02 inside the border, when that leaves at least 0.05.
- **Inner border:** denticles, beads or a step, as a smeared band.
- **Rim:** solid, up to the rim thickness.

Smeared layers have density φρ and out-of-plane stiffness φE, which keeps them attached so they create no spurious modes. Every upper layer below the rim also carries a thin extra layer, 2% of the local field thickness × (1 − f), so no element collapses. The solid rim (f = 1) gets none and stays exactly at the entered thickness. The layer is additive, not a floor. Pro 4.11 used max(f·depth, 2%), which put a kink in λ² at rims within about 3% of the mean thickness; the additive layer is smooth there. Every thickness in the cross-section is then linear in the field thickness, so the field thickness that conserves mass is solved exactly from two evaluations. Their in-plane stiffness is βE with β ≤ φ, because separate relief islands carry little in-plane stress. The field thickness is solved so the volume matches mass/density, so mass is conserved exactly.

**Morgan priors** (4.11):

| Prior | Range | Reason |
|---|---|---|
| Die basin s, per side | 0–0.16 mm | Basined dies. One numismatic estimate of a Morgan's die radius is about 50 inches, a 0.11 mm sagitta over the field. Die lapping flattens it. The lower bound was widened from 0.05 to 0 mm after the first comparison with M06, which alone favours 0.04–0.07 mm. |
| Rim width | 2.5–6% of radius | A narrow raised border. |
| Denticle band | 3–7% of radius; height 50–90% of field depth; fill 40–60% | Separate teeth. |
| Central relief | height 40–90% of field depth; fill 30–50% | Wear lowers the high points; this is the wear allowance. |
| Legend band | height 50–90%; fill 20–40% | Letters and stars. |
| Relief in-plane stiffness | 5–60% of its fill | Mostly islands. |
| Through-thickness shear modulus | 0.9–1.3 × isotropic | Rolling texture. Silver's fibre textures bound it at 0.86 (⟨111⟩) to 1.55 (⟨100⟩). |
| Rim thickness | caliper reading ± 0.03 mm, or 1.034–1.254× the volume-equivalent thickness | 2.35–2.85 mm at catalogue weight: reported Morgan rims range from 2.4 to 2.8 mm, varying by mint and die. |

**Generic priors** (4.12), for every other coin. These are broad engineering ranges for struck coins, not measurements of any particular design:

| Prior | Range | Reason |
|---|---|---|
| Die basin, per side | 0–7% of the volume-equivalent thickness | The Morgan range, scaled to thickness. |
| Rim width | 2–10% of radius | From narrow raised borders to wide flat bullion rims. |
| Inner border | 3–7% of radius; height 30–90% of field depth; fill 30–70% | Denticles, beads or a step. |
| Central device | out to 50–75% of radius; height 30–90% of field depth; fill 25–55% | Portraits and arms; wear lowers the high points. |
| Legend band | height 40–90%; fill 10–40% | Letters, when there is room. |
| Relief in-plane stiffness | 5–60% of its fill | As for the Morgan. |
| Through-thickness shear modulus | 0.9–1.3 × isotropic | As for the Morgan; gold and copper alloys are similarly anisotropic. |
| Rim thickness | caliper reading ± 0.03 mm, or 1.03–1.45× the volume-equivalent thickness | Published thicknesses of a few coins give about 1.23 (Krugerrand) to 1.40 (90% dime). These figures were recalled, not checked for this document. |

Without a caliper reading, the rim prior is a ratio of each hypothesis's own volume-equivalent thickness, so a fake of the same weight is judged by the same rule as the genuine coin. A caliper reading applies to every hypothesis.

**Tables** (`pro/solid-tables.js`, from `npm run solid:tables`, about an hour on 4 cores). Each family's Latin-hypercube samples (40 Morgan, 48 generic) are solved on one grid:
- volume-equivalent thickness/radius 0.02–0.23 in steps of 0.03 (Morgan 0.08–0.20);
- rim/volume-equivalent thickness 1.00–1.50 in steps of 1/12;
- ν 0.27–0.43 in steps of 0.04.

That is 20,440 cross-sections, 16,425 of them admissible, covering every catalogue coin (thickness/radius 0.029–0.152, ν 0.28–0.42) and every listed fake that calipers would not catch.

*Interpolation* is quadratic along each axis. Near a free edge the 3D correction grows roughly in proportion to h/a rather than (h/a)², so linear interpolation on this grid erred by up to 0.11% on thickness and 0.075% on rim. Quadratic interpolation errs by at most 0.018% and 0.003%. A sampled cross-section that cannot exist at the exact inputs is dropped; the app checks this directly with the geometry code shared with the generator, and no eigenvalue solve is needed. When a neighbouring grid node is inadmissible, the lookup switches that axis alone to its other quadratic stencil, then to linear. If neither works, it uses a one-sided quadratic that extrapolates at most one grid step from admissible nodes. That keeps nearly flat coins, whose rim barely exceeds their mean thickness, from losing most of their cross-sections.

*Error margin.* The generator measures the interpolation error against direct solves at 24 random off-grid points per family, including the band just above the lowest rim node: 1.7·10⁻⁴ for the Morgan family and 2.0·10⁻⁴ for the generic family. That value, or 2·10⁻⁴ if larger, is the family's numerical margin, doubled as elsewhere.

*Storage.* Values are stored as 16-bit integers over each mode's range; quantisation error is about 10⁻⁵.

*Out of range.* Inputs outside the grid make the family invalid with a stated reason; nothing is extrapolated.

*Checks.* `npm run solid:check` (run in CI) recomputes grid entries and off-grid points for both families.

*Rim.* A measured rim gives three cross-sections per sample: the reading and ±0.03 mm. The prior gives its endpoints and the grid points between them.

**Scoring, when this model is selected:**
- **Split pairs.** The model is axisymmetric; relief and rolling texture split each (n,s) pair. To first order the split moves ω² symmetrically, so a family of close tracks (the existing 3% grouping) is scored at its RMS frequency. M06's (2,0) pair, 4246/4369 Hz (2.9% split), is scored at 4308 Hz. An orthotropic sheet splits only n = 1 and n = 2 at first order, which matches M06: its (3,0) and (4,0) are single.
- **Centre support.** Under **Held during the test → At the centre**, the default, the (0,1) and (1,1) modes are not scored. Their envelopes extend 15% upward, so a support-shifted tone is still explained.
  - *Why.* A Pocket Pinger holds the coin between silicone tips at the centre of both faces. Those modes move there; n ≥ 2 modes have zero displacement and slope there.
  - *Modelled* (`research/solid/grip.py`, Morgan cross-section). Soft pads raise (0,1) by up to 5% and move n ≥ 2 by less than 0.001%.
  - *Measured on M06.* (0,1) at 7.68 kHz decays with Q ≈ 1,000–1,300, against 3,000–17,000 for the n ≥ 2 modes.
  - *Hard tongs.* A rigid clamp over 2.5 mm of radius replaces the n = 0, 1 spectrum and raises (2,0) by up to 3%; hard tongs are outside this model.
  - *Other supports.* **Other or unknown** scores all six modes.
- **Early-window scan.** Upper modes decay far faster than the lowest mode. On M06 the (4,0) mode at 17.3 kHz has τ ≈ 70–110 ms against about 1 s for (2,0). Over the full 0.6 s ring it sits 55–75 dB below the loudest tone, under the detector's 42 dB threshold, though only 15–40 dB down in the first 100 ms.
  - This model's analysis also searches the first 100 ms, with the same peak rule, pre-strike noise check and persistence check.
  - It searches only above 1.4× the lowest tone the standard detector kept: strike and holder sounds are loudest early, and every modelled second mode is at least 1.5× the lowest (1.62 in the solid tables, 1.54 across the thin-plate catalogue). It cannot change the lowest repeatable resonance.
  - Found tones are marked in exports (`early: true`, strike `upperScan: "early-window-v1"`), and their levels are taken from the full-ring spectrum.
  - The standard detector is unchanged.
- **Fakes.** Since 4.12 the construction screen and the analysis floor use the same solid model and cross-section family as the coin under test; only the material changes. A fake thicker than the tables (volume-equivalent thickness/radius above the grid) has no admissible cross-section, and neither does one thicker than the entered rim allows. Both are reported as caught by calipers, as before. In 4.11 the fakes stayed on the thin-plate model.
- The 3% fit tolerance, the three-mode requirement, harmonic candidates, guards and verdict rules are unchanged.

**Result on one specimen.** M06: 1881-S, VF, 25.81 g, 37.7 mm, rim 2.40 mm, Pocket Pinger, three taps (`tests/fixtures/morgan-m06`). Authenticity has not been verified independently. The mass is 0.92 g under the 26.73 g standard, well beyond mint tolerance and ordinary wear.

| | Thin plate, same inputs | 3D solid, rim 2.40 mm |
|---|---|---|
| Lowest-mode band | 4105–4812 Hz | 3793–4646 Hz |
| Modes found | (2,0) pair, (3,0) | (2,0) pair, (3,0), (4,0) at 17.3 kHz |
| Result | Primary frequency in band, 2 modes | Model consistent |
| Fit residuals | — | (2,0) +0.08%, (3,0) −0.16%, (4,0) +0.08% |

With the early scan but the thin-plate model, the three tones fit with 0.5–1% errors. Competing identities also fit within 3%, so the result stays "ambiguous". The solid model's fit is unambiguous even with all six modes scored.

Of the 40 sampled cross-sections, 6 fit both upper ratios within 0.5%, all with a die basin of 0.04–0.07 mm. The lowest mode then implies an effective modulus of 82–85 GPa at the assumed density, against the 82 GPa handbook value. The measured (0,1) sits 0.7–1.1% above those cross-sections' free-disc prediction, consistent with the soft-pad calculation. Pro's Model tab reports a closest-fit summary: every fitted mode within 0.5%, across the ±0.03 mm rim tolerance. For M06 it shows 0.01–0.10 mm and 82–87 GPa. It is descriptive and not scored.

**Band width, and what it costs.** Across all 105 catalogue coins, with the rim unmeasured:
- **Upper edge:** 1.5–4.1% below the thin-plate edge. This is the physics correction.
- **Lower edge:** 13.8–20.1% below the thin-plate edge. The generic priors admit tall rims, deep basins and heavy relief that adds little stiffness, and all of them lower the pitch.

| Band half-width (min / median / max) | |
|---|---|
| Thin plate | 9.8 / 10.0 / 10.2% |
| Solid model, rim unmeasured | 15.7 / 18.6 / 18.8% |
| Solid model, rim measured | 11.5 / 14.2 / 14.9% |

A measured Morgan is ±10%. Across the catalogue, pitch or calipers rule out 398 of the listed fakes with the solid model, against 466 with the thin plate: honest priors cost discrimination.

With the rim measured, the spread across generic cross-sections is about 13% on the lowest mode for a Krugerrand, a 90% dime or a sterling crown. It correlates most with the relief's in-plane stiffness (+0.5), the rim width (−0.4), the legend height (−0.4) and the relief fill (−0.35). Rim width can be measured. The relief parameters can be pinned down only by recorded coins of known authenticity, the way M06's upper-mode ratios pinned its die basin.

**Towards Lite.** Lite scores the lowest mode alone, from catalogue weight and diameter, with no rim reading. With the generic priors that band would be about 19% wide against today's 10%, so Lite's PASS would accept a wider range of pitches. Before Lite uses this model it needs, per coin:
- a catalogue rim thickness (published or measured);
- priors narrowed by genuine recordings.

Meanwhile the physics correction alone (the 1.5–4% on the upper edge) could move to Lite without the wider priors.

**Limits.**
- One unverified specimen. Nothing here is calibrated on real coins, and no coin other than the Morgan has been recorded against it.
- The 3% fit tolerance is wider than the family's own spread. For (3,0)/(2,0) that spread is 2.29–2.37 with a measured rim of 2.40 mm, and 2.29–2.42 under the rim prior. Upper modes add little discrimination until genuine specimens justify a tighter tolerance.
- Axisymmetric: split pairs are not predicted.
- The faces are mirror-symmetric, whereas the obverse and reverse differ.
- Reeding and rim rounding are not modelled.
- Relief is smeared and its priors are engineering estimates, not measurements of Morgan dies.
- E and ν are handbook values for .900 silver.
- The generic family knows nothing specific about any design. Its priors are deliberately broad, so without a rim reading its bands are wide (below).
- Clad and layered coins enter as their equivalent homogeneous plate. That is exact for thin-plate bending but approximate for the 3D thickness corrections.

**Next data that would sharpen it:**
- Three taps and a rim reading for each of several Morgans verified independently.
- A thickness through the cheek and eagle's breast, which bounds the relief.
- Repeat taps with a second support, to confirm which modes the support moves.

## Analysis floor — Pro 4.10 / Lite 3.7 (current)

This section is current. The verdict rules above are unchanged; the detector now ignores tones below a floor derived for each coin.

**Why.** The striker has resonances of its own. A stick that rings for about 100 ms at 200–300 Hz (Q near 100) survives the windowed spectrum and both persistence windows. It repeats across taps because it is the same stick, so it becomes the lowest repeatable family, and a genuine coin fails with a pitch far below its band. A loud thud also set the detector's −42 dB peak threshold and its prominence reference.

**A fixed cutoff does not work.** The two 4-ducat entries ring at 662–848 Hz. The next-lowest coin, the 1 Ducat, starts at 2649 Hz, and the clad dime at 11 kHz. A cutoff above about 650 Hz loses the 4 Ducats; one below 300 Hz barely helps them and does nothing for the rest.

**Derivation.** For a coin, take every hypothesis the app can name: the genuine coin and each modelled construction. A shell's band lies between its bare core and the genuine alloy, so the bare core covers every shell. Let L be the lowest band edge among these hypotheses. Let R be the largest ratio of second-lowest to lowest mode across their geometry candidates, widened by twice the convergence margin; it is 1.72–1.87 in the current family. Let e be the 2% edge guard. Then

floor = (1 − e) · L / R,

and the detector never searches below 220 Hz whatever the floor.

**Guarantee.** Every modelled lowest mode is at least R above the floor, so the model can overpredict a coin's pitch by about 1.7–1.9× before the floor touches a real ring. Anything whose lowest mode falls under the floor has its next mode below R · floor = (1 − e) · L, which is below the guarded band of every hypothesis. Hiding a tone can therefore leave a result at NO PASS, but it cannot produce a PASS, provided that next mode is observed.

The limit: if an object's lowest mode is hidden and its second mode is not excited either, its third mode, 2.3–2.6× the lowest, could reach the band. That is the existing missed-lowest-mode risk with one more mode missing. It concerns only objects ringing below about half of every modelled band, and no modelled fake does.

**Why the fakes count.** A lead–tin casting of a silver coin rings as low as 0.3× the genuine band. A floor set from the genuine band alone would hide its lowest mode, and one of its upper modes could then be read as its lowest tone. Including every construction keeps the construction screen's verdicts sound as well.

**Values** (catalogue dimensions, default family):

| Coin | Floor | Lowest modelled hypothesis |
|---|---|---|
| 4 Dukata 1931–33 | 347 Hz | genuine, 662 Hz |
| 4 Ducat | 365 Hz | genuine, 696 Hz |
| Morgan dollar | 766 Hz | lead–tin casting, 1462 Hz (genuine from 3925 Hz) |
| Krugerrand | 2096 Hz | genuine, 4000 Hz |
| Dime, clad | 6255 Hz | genuine, 11028 Hz |

New catalogue entries and constructions get a floor automatically. A test checks the guarantee for every catalogue entry, with the default family and with the widest family Pro allows.

**Not a filter.** The floor limits where the detector searches for peaks and computes prominence. The audio itself is not filtered: a time-domain high-pass filter struck by a thud rings near its own cutoff and could create a tone. Tones above the room noise but under the floor are kept for each tap as "Below analysis floor" evidence, and Pro's spectrum shades that region. They are never scored.

Pro computes the floor from the entered values, so edited mass, diameter, modulus or family limits move it. Each tap's settings and measurement exports record `analysisFloorHz`. Saved recordings keep the detector that measured them.

**Residual.** A striker resonance between the floor and the coin's band can still appear, for example a 350 Hz stick on the 4 Dukata. What separates it is a short decay: the synthetic stick in the tests has Q ≈ 94 (τ = 100 ms at 300 Hz), while the app's default material Q for coins is 2000, a model assumption rather than a measurement. Decay does not yet enter acquisition; using it needs calibration on real recordings of both.

## Counterfeit constructions — Pro 4.9 / Lite 3.6 (current)

This section is current. It adds a second screen beside the verdict; the verdict rules above are unchanged.

**Threat model.** Each construction is a fake made to the coin's mass and diameter: the kind that passes a scale and calipers. Lite uses catalogue mass and diameter, and Pro uses the entered values. The fake's thickness follows from its density (h̄ = m/(ρπa²)), and it is modelled with the same stepped-rim family, 2% edge guard, mass and diameter uncertainty and entered rim constraint as the genuine coin. Only the material changes.

**Constructions listed.** Only gold and silver coins get constructions; base-metal and clad coins list none.

| Coin metal | Construction | Material model |
|---|---|---|
| Gold | Gold-plated tungsten | Tungsten or W–Ni–Fe heavy alloy; plating is negligible |
| Gold | Tungsten core in a gold shell | Laminate: genuine alloy faces on a tungsten core |
| Gold | Underfine gold | 5 points less gold, balance copper; entered E and ν |
| Gold | Gold-plated brass, copper | Base metal |
| Silver | Silver-plated molybdenum | Molybdenum; density close to silver |
| Silver | Molybdenum core in a silver shell | Laminate: genuine alloy faces on a molybdenum core |
| Silver | Underfine silver | 5 points less silver, balance copper; entered E and ν |
| Silver | Silver-plated brass, copper, nickel silver, zinc alloy, steel; lead–tin casting | Base metal |

**Material ranges.** Fake materials use deliberately wide handbook ranges, because the grade of a fake is unknown. Each range becomes a midpoint and a ± percentage that spans it, and replaces the default ±5% modulus and ±1% density terms for that material.

| Material | Density g/cm³ | E GPa | ν |
|---|---|---|---|
| Tungsten / W–Ni–Fe heavy alloy | 17.0–19.3 | 300–411 | 0.28 |
| Molybdenum | 10.10–10.28 | 300–330 | 0.31 |
| Copper | 8.89–8.96 | 110–130 | 0.34 |
| Brass (60–85% Cu) | 8.39–8.75 | 100–117 | 0.34 |
| Nickel silver | 8.60–8.80 | 117–132 | 0.33 |
| Zinc die-casting alloy | 6.60–6.70 | 83–96 | 0.28 |
| Lead–tin casting alloy | 8.40–11.30 | 14–45 | 0.42 |
| Steel | 7.80–7.90 | 190–210 | 0.29 |

These are typical handbook values, not measurements of real fakes. The brass preset now carries a measured density range; the earlier mixture rule gave 8.23 g/cm³, below real brass.

**Separable by pitch.** A construction is separable when its model band and the genuine band do not overlap. Then no frequency that passes as genuine lies in or near the construction's band. The margin shown is the gap between the nearest band edges. A construction with no admissible shape (above the 0.25 local thickness/radius limit) is reported with its thickness relative to a genuine coin: at full weight it would be far thicker, which calipers catch.

**Shells.** Shell bands fall steadily from the bare core to the genuine alloy as the shell thickens. Before a test, bisection finds the thickest shell whose band still clears the genuine band. It is reported as a fraction of thickness and of weight.

**Against a reading.** After a complete test with a repeatable lowest family, each construction is judged by the same rules as Pro's screen:
- It is ruled out when the lowest repeatable resonance is outside its guarded lowest-mode band.
- A construction whose band lies below the reading stays possible only if the recurring tones fit it as upper modes with its lowest mode unobserved.
- For shells, the fitting shell thicknesses form one interval, found by bisection on the lowest-mode band. The screen says which shell thicknesses remain possible.

**Worked numbers** (catalogue dimensions, default assumptions):
- Krugerrand: genuine 4000–4871 Hz; plated tungsten 7189–11586 Hz, at least 48% above. A tungsten core is separable while the gold shell is under 39% of the thickness. A full-weight brass or copper Krugerrand would be about twice as thick, beyond the model.
- Morgan dollar: genuine 3925–4801 Hz; plated molybdenum 65% above, brass 21% above, copper 22% above.
- Underfine gold and silver (5 points) overlap the genuine band for every coin tried. Fineness changes this small barely move the pitch.

**Limits.**
- A copy struck in the correct metal rings like a genuine coin; neither pitch nor an electromagnetic test catches it.
- Shells are modelled as uniform faces over the whole disc. A solid gold rim, an inserted plug or an off-centre core is not represented.
- Underfine gold keeps the entered modulus. Real Au–Cu moduli rise with copper, which would move the pitch slightly further.
- The lead–tin range is very wide, so it overlaps silver bands; in practice these castings ring dull and short.
- None of this is validated against real fakes yet; that is the next step.

## Layered plates — Pro 4.9 / Lite 3.6 (current)

A symmetric three-layer plate with faces of total thickness fraction x around a core has bending stiffness D11 = (h³/12)·Σ Eᵢ/(1−νᵢ²)·wᵢ, where the faces' weight is w = 1−(1−x)³ and the core's is (1−x)³. Its D12/D11 gives the equivalent ν. The equivalent homogeneous plate keeps the laminate's mass per area, E/(1−ν²) = 12·D11/h³ and that ν, so the existing solver applies unchanged. Its uncertainty stacks the layers' ± percentages linearly by stiffness share (modulus) and mass share (density).

The US clad presets now use this model:
- Cupronickel clad: 75 Cu / 25 Ni faces carrying one third of the mass on a copper core. E rises from 125 to 137.6 GPa, which raises the band by about 5%.
- 40% silver clad: .800 silver faces on a .209 silver core, 40% silver overall. E falls from 98 to 94.8 GPa. The core modulus of 110 GPa is interpolated, not measured.

**Solver.** The eigenvalue step now uses cyclic Jacobi sweeps instead of largest-pivot Jacobi. The rotations and stopping rule are the same. Eigenvalues agree to better than 10⁻¹² on the solver's own matrices, and it runs about four times faster, which the construction screen needs.

## Field screen — Pro 4.6 / Lite 3.4

The initial acoustic screen uses the lowest retained, non-harmonic family recurring across every accepted tap, independent of which peak is loudest and independent of upper-mode fit quality. This is an observed frequency candidate, not a proven fundamental: a still-lower coin mode might not be excited or detected. Two taps (Lite) or three (Pro) establish repetition under the existing 1% tracking rule; one Lite tap can display only a provisional result. A matching candidate inside the guarded lowest-mode band supports a limited field result. It cannot establish material or authenticity, so the user is directed to check physical measurements and metal independently.

Pro retains its strict, simultaneous three-mode fit as an additional, more detailed model claim. A failed or unavailable upper-mode fit does not nullify an in-band lowest candidate. Conversely, when the lowest retained frequency is above the lowest-mode band, a missed lower resonance remains possible and the result requests another strike rather than rejecting the coin. A repeatable lowest family below the band remains an outside-model finding. The frequency envelopes, 3% joint-fit tolerance and detector thresholds are unchanged. The older sections below document historical versions rather than current verdict logic.

## Primary resonance accounting — Pro 4.5 / Lite 3.3

Primary and secondary evidence are now explicit. The primary acoustic family is the recurring family containing the strongest within-tap normalized track; it is selected from the measurement before theoretical assignment. Equal-strength ties resolve deterministically to the lower-frequency family. If the primary family intersects the modeled lowest-mode envelope but a secondary recurring family falls outside all modeled envelopes, Pro reports the primary resonance as consistent while leaving the full modal pattern unresolved. Lite retains its narrower lowest-mode screen and reports the primary as within band, with the secondary family displayed separately. Only a primary family outside all modeled envelopes drives the direct outside-model verdict in this case.

This rule does not widen microphone, recurrence, geometry, material, or fitting tolerances. Relative level only identifies which recurring family is primary; it is not composition evidence. The secondary mismatch remains evidence of model incompleteness or an unexplained component, and positive Pro material consistency still requires the existing three-mode joint fit.

## Acoustic interpretation update — Pro 4.4 / Lite 3.2

The forward geometry solver and all nuisance/fit tolerances are unchanged. This update improves measurement resolution and interpretation, not the modeled coin shape or an empirical authenticity calibration.

The detector uses a four-term Blackman–Harris window. A spectral peak pair must be at least 4/T apart (T is the actual analyzed duration, not the zero-padded FFT length), with a valley at least 6 dB below the weaker peak. The old 1.2% suppression is removed. Close components use 0–240 and 240–520 ms post-skip windows to check persistence; other tones use 0–80 and 80–200 ms. Persistence neighborhoods are limited to a quarter of the nearest candidate gap to avoid borrowing energy from a neighbor. Early/late level changes are descriptive and the window pair is retained with each peak.

Across taps, a candidate match must be within the existing 1% cap AND within 45% of the nearest within-tap neighbor gap at each end. Resolved neighbors cannot stand in for one another. Only tracks present in every accepted tap contribute to fitting; other observations are displayed separately. These rules trade sensitivity for conservative identity tracking and require wider empirical validation.

Close-frequency grouping remains descriptive at 3%; it is not a validated splitting limit. Members of the same group may not fill two independent slots in a three-mode joint assignment. Sharing a theoretical mode envelope is displayed as a limitation, not as proof of splitting. The model remains axisymmetric and cannot account for general relief, anisotropy, or pinger-contact perturbations.

UI outcomes distinguish insufficient independent modes and unresolved fits from observations outside the current model. Lite's positive result is explicitly only a provisional lowest-mode band comparison. A good two-mode ratio is useful evidence but does not satisfy Pro's unchanged three-independent-mode requirement.

This is an exploratory forward model, not an authenticity calibration. The parameter ranges below are explicit engineering assumptions, not measured population limits. Do not tune them to make an unverified specimen pass.

## Shape and conservation of mass

Model a homogeneous isotropic circular plate with a common mid-plane, a thinner centre, and a concentric thicker annulus. It is a two-zone thickness approximation, not a concave shell. Relief, eccentric rims, rolling texture, cracks and contact-induced frequency shifts are not represented. Layered construction enters only as an equivalent homogeneous plate (see "Layered plates").

Let outer radius be a, the centre/annulus interface be b*a, centre thickness hc, rim thickness hr, and t=hr/hc. The volume-equivalent thickness is hbar=m/(rho*pi*a²). Keeping mass fixed gives hc=hbar/[b²+t*(1-b²)], hr=t*hc. A measured rim thickness instead determines hc=[hbar-(1-b²)*hr]/b²; impossible or out-of-family combinations are excluded.

The initial grid includes a uniform plate plus rim widths 3%, 6%, 9%, 12%, 16% of radius and five evenly spaced thickness ratios from 1 to 1.75. Pro can change the maximum width and ratio. This finite grid is a sensitivity study, not an exhaustive set of all real coin shapes.

## Variational eigenproblem

Use Kirchhoff–Love bending energy and free natural edge conditions. For W(r,theta)=sum(c_i*r^p_i)*cos(n*theta), normalized radius r in [0,1], use powers p=n+2k. Define A_i=p_i*(p_i-1), B_i=p_i-n², C_i=n*(p_i-1). Apart from the cancelling angular factor:

K_ij = integral h(r)^3 * [A_i*A_j+B_i*B_j+nu*(A_i*B_j+B_i*A_j)+2*(1-nu)*C_i*C_j] * r^(p_i+p_j-3) dr.

M_ij = integral h(r)*r^(p_i+p_j+1) dr.

The code uses thickness relative to hbar and evaluates both zone integrals analytically. For n=0 and n=1, project the trial functions perpendicular to rigid translation/tilt in the mass inner product; simply deleting the rigid term would give incorrect free-plate modes. Cholesky whitening transforms K c = lambda^4 M c into a symmetric eigenproblem, solved with cyclic Jacobi rotations.

Frequency f=lambda²*hbar/(2*pi*a²)*sqrt[E/(12*(1-nu²)*rho)]. We track the same six mode labels as the old solver, with frequencies allowed to change order. The old uniform-plate cubic remains an independent numerical limit check and a legacy playback helper.

Compare six and eight radial trial functions. Twice their relative discrepancy is included as an exploratory numerical margin. This convergence indicator is not a rigorous error bound. Reject shapes with a local thickness/radius ratio above 0.25; even below that bound, neglected transverse shear and rotary inertia can matter, especially for upper modes. A future Mindlin or independently benchmarked finite-element calculation is needed to reduce that model error.

## Bands and fitting

Default nuisance assumptions are E ±5%, density ±1%, mass ±1%, diameter ±0.5%, with Poisson ratio fixed to the selected material. The frequency scale at fixed relative shape is m*sqrt(E)/[d^4*rho^(3/2)*sqrt(1-nu²)]. Endpoint propagation follows this formula rather than a universal ±8% band. The optional measured-rim case uses the nominal mass/density profile; uncertainty scaling then holds that inferred relative shape fixed and does not re-enforce the rim measurement at every endpoint.

The displayed model band spans the predicted lowest mode across sampled shapes and nuisance endpoints. A 2% relative guard around each endpoint is inconclusive; a value strictly inside the guards is compatible with these assumptions; beyond the outer guards it is anomalous relative to this family. Guard widths are provisional operational settings. A single tap is explicitly provisional and an anomaly requires a repeat. Compatibility does not establish composition.

Pro fits recurring measured peaks with one-to-one mode assignments. It compares ratios and absolute frequencies simultaneously, allows one common scale only within propagated nuisance bounds, and requires at least three distinct recurring peaks for material compatibility. The default per-peak and ratio residual limit is 3%, plus the numerical convergence margin. One or two peaks cannot establish a material fit. Missing modes are unobserved evidence, not coin failures. Alternative materials use the same mass, diameter and shape assumptions. Multiple surviving alloys must remain ambiguous; a good fit cannot identify purity.

## Reference specimens

Revision 4 distinguishes a persistent peak track from a theoretical mode label. Tracks must recur within 1% across every accepted tap. Frequencies from individual taps are retained. Tracks within 3% are displayed as a possible split family, while larger separations remain distinct; the 3% grouping is an operational hypothesis for inspection, not an empirical coin-specific limit and does not improve the compatibility score.

For exclusion, each modeled mode receives its own frequency envelope across all admitted rim geometries and material/dimension uncertainty. A resonance family repeated across the taps and lying more than 1% outside every such envelope is reported as acoustically anomalous. This is a model-compatibility failure, not a counterfeit verdict.

Before fitting or exclusion, a recurring family within 0.8% of an integer 2×–5× multiple of a lower family is marked as a possible harmonic. It remains visible in the fingerprint but is not counted as an independent plate mode and cannot create either positive compatibility or an anomalous envelope result.

Ratio comparisons enumerate distinct model-mode pairs across sampled geometries. A ratio-only resemblance is reported separately from a joint assignment because another alloy or geometry can reproduce one ratio. Positive Pro compatibility requires at least three modes to agree in both ratios and absolute frequency under one scale inside the stated nuisance bounds. Repeatable patterns with fewer modes remain useful acoustic evidence but do not establish theoretical material compatibility.

The detector stores normalized within-tap peak level and the spectral-level change between two early ring windows. Both are descriptive fingerprint features. Neither Q nor the early/late level change enters compatibility. Mode overlap, beating, device processing and short captures can make a single-exponential Q estimate misleading.

Revision 3.1 separates loudest measured resonance from estimated fundamental. The fitter enumerates all recurring tones as candidate anchors, including tones below the loudest one. Fundamental selection requires agreement among supported assignments with maximal peak coverage; interpretations that allow a missing lower mode remain unresolved. At least two taps are required for pattern-based identity. A lone tone is a provisional candidate, not proven fundamental. Repeatability tracks the selected peak across taps, so changing relative loudness does not by itself invalidate the mode pattern. This inference uses the selected material/geometry family and is not independent proof of that model. Decay Q remains attached to the loudest measured resonance.

Store several independently verified specimens per coin type, each with a stable user-assigned specimen ID, verification method, notes, observed peaks, capture metadata and at least two repeatable taps. Re-recording the same ID replaces that specimen's entry rather than increasing the specimen count. Legacy single references remain available, but do not automatically become independent verified specimens. Imported IDs and identical tap timestamps are deduplicated.

Report observed specimen median, minimum and maximum as descriptive statistics only. Do not silently replace the physical-model band with a narrow empirical band from a handful of coins. Establishing a production reference distribution requires independently checked specimens, coverage across wear/mints/devices, and held-out evaluation. No synthetic or unverified coin is shipped as a known-good reference.

## Literature grounding

The implementation derives the classical plate energy directly; it does not claim to implement the more complete Mindlin methods in these papers. They establish stepped circular plates as a relevant model class and illustrate why numerical and physical validation matter:

- [Exact vibration results for stepped circular plates with free edges (2005)](https://doi.org/10.1016/j.ijmecsci.2005.04.002).
- [Free Transverse Vibration of Circular Plate of Stepped Thickness with General Boundary Conditions by an Improved Fourier–Ritz Method (2022)](https://doi.org/10.1155/2022/1643050).
