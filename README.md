<div align="center">
  <img src="public/logo.png" alt="Photo Shrinker logo" width="128" />

  <h1>Photo Shrinker</h1>
  <p><strong>Fit your photo to an upload limit — without it ever leaving your device.</strong></p>

  <p>
    <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white" height="20" />
    <img alt="React" src="https://img.shields.io/badge/React-19-087ea4?style=flat-square&logo=react&logoColor=white" height="20" />
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript&logoColor=white" height="20" />
    <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind-4-06b6d4?style=flat-square&logo=tailwindcss&logoColor=white" height="20" />
    <img alt="No backend" src="https://img.shields.io/badge/backend-none-10b981?style=flat-square" height="20" />
  </p>
</div>

---

Government portals rarely say *"this photo is too big"*. They say **"max 10 MB"** — a number most people can't translate into anything they can act on. Open the image, look at a number they don't understand, guess, and get rejected.

Pick the limit your form states. Get a JPEG that lands just under it.

**Nothing is uploaded.** The whole thing runs in the browser tab, which matters when the photos in question are passports and ID documents.

---

## What it does

- **Always outputs JPEG.** PNG is a poor fit for photographs. Whatever you upload, you get a JPEG — which is usually dramatically smaller for this content.
- **Fits the limit, or says why not.** The result is guaranteed to land under your target, or the tool tells you plainly that it can't.
- **Protects a minimum size.** If your form requires a minimum pixel size, the photo is never shrunk below it. An image that's too small gets rejected just as firmly as one that's too big.
- **Handles transparency.** JPEG has no alpha channel. Transparent PNGs would come out with black rectangles, so you pick the fill colour yourself.
- **Before / after.** Drag the divider to see exactly what changed.

## How the solver works

The hard part isn't encoding a JPEG — it's *guaranteeing* a byte ceiling. A quality slider can miss; this solves for the limit.

`src/lib/solver.ts` is a pure function with an injected encoder, which is what makes it testable without a browser.

1. Encode at full resolution, quality 0.75. If it fits, skip straight to step 4.
2. JPEG size is close to linear in pixel count, so estimate the scale needed: `sqrt(target / actual)`.
3. Correct with a few damped iterations until the budget is met.
4. **Binary-search the quality back up.** Leftover bytes buy sharpness instead of being wasted on over-shrinking.
5. If the smallest permitted image still exceeds the target, return `impossible` with a reason rather than quietly missing the limit.

Two details that matter more than they look:

- **Dimensions are snapped to even numbers.** JPEG's 4:2:0 chroma subsampling leaves visible artifacts on odd sizes.
- **Large reductions are done by repeated halving**, not one `drawImage`. A single call averages only a limited neighbourhood per destination pixel, so a 4000 px source scaled to 600 px aliases badly — exactly the passport-photo case, where the face is small in frame.

### Example

| Target | Original | Result | Size | Quality |
|---|---|---|---|---|
| Under 10 MB | 3.8 MB | 2.9 MB | 4000 × 3000 | 94% |
| Under 1 MB | 3.8 MB | **961 KB** | 3972 × 2980 | 76% |
| Under 240 KB | 3.8 MB | **235.6 KB** | 1946 × 1460 | 76% |

Note the middle row: it barely resizes. A naive compressor would shrink the image far more than necessary to hit the same byte count.

## Getting started

```bash
pnpm install
pnpm dev
```

## Checks

```bash
pnpm test        # solver + verdict unit tests
pnpm typecheck
pnpm lint
pnpm build       # static export into out/
```

## Deploying

`next.config.ts` sets `output: "export"`, so the build produces a static bundle with no server component. `pnpm build` writes to `out/`.

| Platform | Build command | Output directory |
|---|---|---|
| Cloudflare Pages | `pnpm build` | `out` |
| Vercel | *detected automatically* | — |
| GitHub Pages | `pnpm build` | `out` |
| nginx / any web server | `pnpm build` | serve `out/` as-is |

## Scope

This resizes and recompresses. It **never crops**.

Forms that specify a print size or aspect ratio (35×45 mm, 2×2 in) also specify framing and head position, which this tool does not attempt. Offering a "passport photo" preset would promise framing it can't deliver, so only byte limits are offered — the thing it can actually guarantee.

### Why there's no Web Worker

Compression runs on the main thread, yielding between attempts with `scheduler.yield()` so the progress UI keeps painting.

`new Worker(new URL("./worker.ts", import.meta.url))` is the obvious alternative, but Turbopack copies that target into `static/media/` **verbatim** instead of compiling it — a production build ships raw TypeScript that no browser can execute, while `next dev` works fine and hides the bug. A plain `.js` worker would run, but it couldn't import the solver without duplicating the algorithm into a second implementation that would silently drift from the tested one.

Worth revisiting once Turbopack supports bundling worker entries, or by precompiling the worker into `public/`.

## Project layout

```
src/
├── app/                    # Next.js App Router shell
├── components/             # Dropzone, TargetPicker, BeforeAfter, CompressorPanel
└── lib/
    ├── solver.ts           # size-solving search (pure)
    ├── solver.test.ts
    ├── jpeg.ts             # canvas encoding, progressive downscale, alpha flatten
    ├── verdict.ts          # portal acceptance rules (pure)
    ├── verdict.test.ts
    ├── presets.ts          # byte-limit presets
    ├── types.ts            # shared types
    └── compressor.ts       # decode → solve → encode pipeline
```

The two pure modules hold all the domain logic and are the only ones worth reading first.

## Browser support

Needs `createImageBitmap` and canvas `toBlob` — Chrome, Edge, Firefox and Safari 16.4+. Encoding runs at roughly 0.1–0.3 s per pass for a 12 MP photo.

## License

MIT