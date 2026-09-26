# RingBench geometry family, revision 3

## Verdict rules — Pro 4.8 / Lite 3.5 (current)

This section is the current verdict logic. Where any later section disagrees, including "Bands and fitting" and "Reference specimens", this section applies. The forward model, detector thresholds, 3% fit tolerance and band construction are unchanged.

**Tap count.** No result is given until the edition's full tap count is recorded: two for Lite, three for Pro. Before that, only measurements are shown.

**Lite.** The lowest repeatable non-harmonic family is compared with the guarded lowest-mode band for the catalogue coin. Strictly inside the guards is PASS. Anything else is NO PASS: below the band, above it, within a guard, or no tone repeating across both taps. Lite cannot tell a missed lowest mode from a coin that rings high, so it does not try.

**Pro, above the band.** A missed lowest mode stays open ("Lower mode not established") only when a supported identity fit anchors the lowest recurring family on a higher mode with the lowest mode unobserved, and that family lies inside a modeled envelope. Otherwise the result is outside the model. A lone tone above the band therefore cannot keep that possibility open.

**Pro, Model consistent.** In addition to the three-mode joint fit, an unambiguous lowest-mode estimate and no unexplained secondary family, the fitted lowest mode must lie in the lowest repeatable family.

**Harmonic candidates.** A family within 0.8% of a 2×–5× multiple of a lower family stays out of scoring and envelope exclusion. The joint fit may use it as an upper member alongside its parent family, and such fits count only when no three-mode fit exists without one. Plate-mode ratios can fall near integers by coincidence. For a uniform plate at ν = 0.37, (1,1)/(2,0) ≈ 4.010; the same happens for some stepped shapes of silver and gold. The verdict states when a fit relied on such a tone.

**Tracked modes.** The solver computes circumferential orders n = 0–4 and tracks (2,0), (0,1), (3,0), (1,1), (4,0) and (2,1). These are not the six lowest modes. On a uniform plate, (5,0) has λ² ≈ 31.6–33.6 for ν = 0.29–0.42, below (2,1) at ≈ 35.2. A real (5,0) peak is therefore reported as outside every modeled mode. Adding it is a separate model revision.

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

Model a homogeneous isotropic circular plate with a common mid-plane, a thinner centre, and a concentric thicker annulus. It is a two-zone thickness approximation, not a concave shell. Relief, eccentric rims, rolling texture, cracks, layered construction and contact-induced frequency shifts are not represented.

Let outer radius be a, the centre/annulus interface be b*a, centre thickness hc, rim thickness hr, and t=hr/hc. The volume-equivalent thickness is hbar=m/(rho*pi*a²). Keeping mass fixed gives hc=hbar/[b²+t*(1-b²)], hr=t*hc. A measured rim thickness instead determines hc=[hbar-(1-b²)*hr]/b²; impossible or out-of-family combinations are excluded.

The initial grid includes a uniform plate plus rim widths 3%, 6%, 9%, 12%, 16% of radius and five evenly spaced thickness ratios from 1 to 1.75. Pro can change the maximum width and ratio. This finite grid is a sensitivity study, not an exhaustive set of all real coin shapes.

## Variational eigenproblem

Use Kirchhoff–Love bending energy and free natural edge conditions. For W(r,theta)=sum(c_i*r^p_i)*cos(n*theta), normalized radius r in [0,1], use powers p=n+2k. Define A_i=p_i*(p_i-1), B_i=p_i-n², C_i=n*(p_i-1). Apart from the cancelling angular factor:

K_ij = integral h(r)^3 * [A_i*A_j+B_i*B_j+nu*(A_i*B_j+B_i*A_j)+2*(1-nu)*C_i*C_j] * r^(p_i+p_j-3) dr.

M_ij = integral h(r)*r^(p_i+p_j+1) dr.

The code uses thickness relative to hbar and evaluates both zone integrals analytically. For n=0 and n=1, project the trial functions perpendicular to rigid translation/tilt in the mass inner product; simply deleting the rigid term would give incorrect free-plate modes. Cholesky whitening transforms K c = lambda^4 M c into a symmetric eigenproblem, solved with Jacobi rotations.

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
