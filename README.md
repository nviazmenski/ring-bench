# Ring Bench

Flexural-mode prediction and acoustic measurement for struck coins.
Static site — no build step, no dependencies, no server code.

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire application. All physics, UI and DSP. |
| `sw.js` | Service worker. Caches for offline use and self-updates. |
| `manifest.json` | Makes it installable to the home screen. |
| `icon.svg` | App icon. |

## Deploying to GitHub Pages

1. Create a repository named `ring-bench`. It must be **public** — Pages from a
   private repo needs a paid plan.
2. Upload all four files to the repository root. Not in a folder — `index.html`
   has to sit at the top level, with `sw.js` beside it.
3. **Settings → Pages → Source: Deploy from a branch → `main` → `/ (root)` → Save.**
4. Wait about a minute. The URL is `https://<username>.github.io/ring-bench/`.
5. Open it in Safari, allow the microphone, wait for the footer to read
   `cached for offline use`, then **Share → Add to Home Screen**.

HTTPS is what the microphone requires, and Pages provides it. A file opened from
the Files app will never get microphone access, no matter what else is correct.

## Updating

Edit `index.html` in the GitHub web editor — this works from a phone — and
commit. Pages rebuilds in under a minute.

You do **not** need to bump anything. The service worker answers from cache
first, then checks the network in the background. When it sees the deployed
files differ from what it cached, the app shows a banner: *A newer build is
deployed — tap to load it.* So an edit reaches the phone on the second open,
or immediately if you tap the banner.

The footer shows the build stamp of whatever is actually running. Check it when
you are unsure whether a change made it to the device.

## Verifying it works

Two checks, in this order, before trusting a reading:

- The Listen tab must report **`Armed at 48000 Hz`**. If it says 16000 or 8000,
  something has taken the microphone — usually AirPods — and the capture is
  worthless.
- The transpose field must read **0**. Any other value puts a red banner under
  the readout. Playback is not the measurement, but a synthesised ring an octave
  off the real one will talk you into a match that is not there.

## Calibrating it

Nothing in this app has been checked against a coin. Every frequency is a
flat-disc prediction with estimated moduli and invented damping constants.
Two cheap controlled experiments settle whether the physics holds:

- A 1946 and a 1950 British shilling — same mass, same diameter, silver versus
  cupronickel. Predicted gap: **868 cents**.
- A 1964 and a 1965 US quarter — same diameter, silver versus clad. Predicted
  gap: **542 cents**, and the clad coin should read *sharp* of the panel, since
  it is a laminate and the model treats it as homogeneous.

If those land, trust the bench. If the clad quarter reads flat instead of sharp,
the laminate reasoning is backwards and the whole thing needs revisiting.

## What it establishes

That the metal is solid, homogeneous, and of roughly the right stiffness-to-
density ratio for the declared alloy and geometry. Nothing about dies, strike,
or date. It cannot detect a counterfeit struck from correct-fineness metal.

Field order of operations: **magnet, calipers, then ring.**
