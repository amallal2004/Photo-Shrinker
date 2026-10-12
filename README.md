# Photo Shrinker

A browser-based image compressor for people filling in upload forms that demand a
file size in megabytes. Pick the limit the form states, get a JPEG that lands just
under it.

Everything runs client-side. No upload, no backend, no server holding passport or
ID photos.

## What it does

- **Always outputs JPEG**, whatever you upload. PNG is a poor fit for photographs,
  and every browser's encoder produces a much smaller file for photographic
  content.
- **Fills transparency before converting.** JPEG has no alpha channel, so a
  transparent PNG would otherwise come out with black rectangles. Pick the fill
  colour yourself.
- **Solves for the byte limit** rather than offering a quality slider that might
  miss. The result is guaranteed to fit, or the tool says plainly that it can't.
- **Respects a minimum pixel size** when the form states one, so it can't shrink
  a photo into something the portal rejects for being too small.
- **Tells you when the target is impossible** instead of quietly handing over a
  file that would bounce.

## How the solver works

`src/lib/solver.ts` is a pure function with an injected encoder, which is what
makes it testable without a browser.

1. Encode at full resolution and quality 0.75. If it fits, skip straight to a
   quality search.
2. JPEG size is close to linear in pixel count, so estimate the scale needed with
   `sqrt(target / actual)` and re-encode.
3. Correct with a few damped iterations (`× 0.95`) until the budget is met.
4. Once under budget, **binary-search the quality back up**. Leftover bytes get
   spent on quality rather than being wasted by over-shrinking.
5. If the floor size still exceeds the target, return `impossible` with a reason.

Dimensions are snapped to even numbers because JPEG's 4:2:0 chroma subsampling
produces edge artifacts at odd sizes. Large reductions are downscaled by repeated
halving rather than one big `drawImage`, which filters far more cleanly.

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

`next.config.ts` sets `output: "export"`, so the build produces a static bundle
with no server component. `pnpm build` writes to `out/`.

- **Cloudflare Pages** — build command `pnpm build`, output directory `out`
- **Vercel** — detected automatically
- **GitHub Pages** — build and publish `out/`
- **nginx / any web server** — serve `out/` as-is

## Scope

This resizes and recompresses. It **never crops**. Forms that specify a print size
or aspect ratio (35×45mm, 2×2in) also specify framing and head position, which
this tool does not attempt, so no photo presets are offered — only byte limits,
which are what it can actually guarantee. Minimum pixel dimensions are exposed as
an optional field for the forms that state them.

## Layout

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

## Why there is no Web Worker

Compression runs on the main thread, yielding between encode attempts with
`scheduler.yield()` so the progress UI keeps painting.

A `new Worker(new URL("./worker.ts", import.meta.url))` worker is the obvious
alternative, but Turbopack copies that target into `static/media/` **verbatim**
instead of compiling it — the production build ships raw TypeScript that no
browser can execute. A plain `.js` worker would run, but it could not import the
solver without duplicating the algorithm into a second implementation that would
silently drift from the tested one.

If you want the worker back, either precompile it into `public/` or build with
webpack. Revisit this once Turbopack supports bundling worker entries.

## Browser support

Needs `createImageBitmap` and canvas `toBlob`, which covers Chrome, Edge,
Firefox, and Safari 16.4+. Encoding runs at roughly 0.1–0.3s per pass for a 12MP
photo.