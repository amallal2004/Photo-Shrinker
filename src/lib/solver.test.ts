import assert from "node:assert/strict";
import { test } from "node:test";

import { dimensionsAt, maxScaleFor, minScaleFor, solve } from "./solver";
import type { EncodeFn, EncodeResult, SolveRequest } from "./types";

/**
 * Stand-in for a real canvas JPEG encoder.
 *
 * Output size is modelled as linear in pixel count with a quality-dependent
 * bytes-per-pixel curve, which is how real JPEG behaves closely enough that a
 * solver passing against this model will also pass in a browser. A small
 * deterministic jitter makes the search tolerate a non-perfectly-monotonic
 * encoder.
 */
function fakeEncode(content: number): EncodeFn {
  return async (width, height, quality): Promise<EncodeResult> => {
    const bpp = 0.05 + 0.9 * Math.pow(quality, 2.5);
    const jitter = 1 + (((width * 7 + height * 13 + Math.round(quality * 100)) % 7) - 3) / 1000;
    const bytes = Math.max(1, Math.round(width * height * content * bpp * jitter));
    return { width, height, quality, bytes, blob: new Blob([new Uint8Array(0)]) };
  };
}

function request(overrides: Partial<SolveRequest> = {}): SolveRequest {
  return {
    width: 4000,
    height: 3000,
    targetBytes: 1_000_000,
    minWidth: 0,
    minHeight: 0,
    maxLongEdge: 0,
    maxQuality: 0.95,
    minQuality: 0.3,
    referenceQuality: 0.75,
    ...overrides,
  };
}

test("full-resolution probe succeeds when the budget is generous", async () => {
  // A 4000×3000 frame at the 0.75 reference encodes to ~4.7 MB, so 8 MB is
  // genuinely generous and needs no downscale.
  const result = await solve(request({ targetBytes: 8_000_000 }), fakeEncode(0.8));

  assert.equal(result.status, "ok");
  assert.ok(result.bytes <= 8_000_000, `got ${result.bytes}`);
  // No downscale was needed, so full resolution is preserved.
  assert.equal(result.width, 4000);
  assert.equal(result.height, 3000);
});

test("spends leftover budget on quality instead of shrinking further", async () => {
  // Above the ~4.7 MB full-resolution probe, so the solver should keep the
  // resolution and push quality up rather than over-shrinking.
  const result = await solve(request({ targetBytes: 6_000_000 }), fakeEncode(0.8));

  assert.equal(result.status, "ok");
  assert.ok(result.quality > 0.8, `quality ${result.quality} is lower than expected`);
  assert.equal(result.width, 4000);
});

test("keeps iterating when the first scale estimate lands just over the target", async () => {
  // Regression: the initial estimate puts this at ~1,002,816 bytes against a
  // 999,000 limit. The solver must correct and converge on a real image rather
  // than treating the failed estimate as "pinned at the floor".
  const result = await solve(request({ targetBytes: 999_000 }), fakeEncode(0.8));

  assert.equal(result.status, "ok");
  assert.ok(result.bytes <= 999_000, `got ${result.bytes}`);
  assert.ok(result.width > 1000, `collapsed to ${result.width}px wide`);
  assert.ok(result.height > 750, `collapsed to ${result.height}px tall`);
});

test("never collapses to a thumbnail to satisfy an unreachable target", async () => {
  // Regression: with no minimum-size rule the floor scale was 0, so an absurd
  // target collapsed the output to 2×2 and reported success.
  const result = await solve(request({ targetBytes: 50 }), fakeEncode(0.8));

  assert.equal(result.status, "impossible");
  // The floor is 32px on the long edge, so a 3:2 source bottoms out at 32×24.
  assert.ok(
    Math.max(result.width, result.height) >= 32,
    `produced ${result.width}×${result.height}`,
  );
});

test("always returns a file under the target when status is ok", async () => {
  const targets = [50_000, 200_000, 500_000, 1_000_000, 3_000_000, 12_000_000];

  for (const targetBytes of targets) {
    const result = await solve(request({ targetBytes }), fakeEncode(0.8));
    assert.equal(result.status, "ok", `target ${targetBytes} -> ${result.status}`);
    assert.ok(result.bytes <= targetBytes, `target ${targetBytes}, got ${result.bytes}`);
  }
});

test("downsizes when the budget is tight", async () => {
  const result = await solve(request({ targetBytes: 300_000 }), fakeEncode(0.8));

  assert.equal(result.status, "ok");
  assert.ok(result.bytes <= 300_000);
  assert.ok(result.width < 4000, `expected a downscale, got ${result.width}px wide`);
  assert.ok(result.height < 3000, `expected a downscale, got ${result.height}px tall`);
});

test("respects the portal's minimum pixel requirement", async () => {
  const result = await solve(
    request({ targetBytes: 120_000, minWidth: 1000, minHeight: 750 }),
    fakeEncode(0.8),
  );

  assert.equal(result.status, "ok");
  assert.ok(result.width >= 1000, `width ${result.width} below minimum`);
  assert.ok(result.height >= 750, `height ${result.height} below minimum`);
});

test("reports impossible when the limit cannot be met without breaking the minimum size", async () => {
  const result = await solve(
    request({ targetBytes: 5_000, minWidth: 1000, minHeight: 750 }),
    fakeEncode(0.8),
  );

  assert.equal(result.status, "impossible");
  assert.ok(result.bytes > 5_000);
  assert.ok(result.reason);
});

test("honours the long-edge cap on very large sources", async () => {
  const req = request({ width: 12_000, height: 9_000, targetBytes: 2_000_000, maxLongEdge: 6000 });
  const result = await solve(req, fakeEncode(0.8));

  assert.equal(result.status, "ok");
  assert.ok(result.bytes <= 2_000_000);
  assert.ok(Math.max(result.width, result.height) <= 6000, `long edge ${result.width}x${result.height}`);
});

test("emits even dimensions to avoid chroma-subsampling artifacts", async () => {
  for (const targetBytes of [150_000, 400_000, 900_000]) {
    const result = await solve(request({ targetBytes }), fakeEncode(0.8));
    assert.equal(result.width % 2, 0, `odd width ${result.width}`);
    assert.equal(result.height % 2, 0, `odd height ${result.height}`);
  }
});

test("stays within a sensible number of encode passes", async () => {
  const result = await solve(request({ targetBytes: 400_000 }), fakeEncode(0.8));
  assert.ok(result.passes <= 14, `took ${result.passes} passes`);
  assert.ok(result.passes >= 1);
});

test("reports progress for every encode pass", async () => {
  const seen: number[] = [];
  await solve(request({ targetBytes: 400_000 }), fakeEncode(0.8), (p) => seen.push(p.passes));

  assert.ok(seen.length > 0);
  assert.deepEqual(seen, seen.map((_, i) => i + 1));
});

test("scale helpers respect both bounds", () => {
  const req = request({ width: 4000, height: 3000, minWidth: 1000, minHeight: 750, maxLongEdge: 2000 });
  assert.equal(maxScaleFor(req), 0.5);
  assert.equal(minScaleFor(req), 0.25);

  assert.deepEqual(dimensionsAt(req, 0.5), { width: 2000, height: 1500 });
  assert.deepEqual(dimensionsAt(req, 1), { width: 2000, height: 1500 });
});

test("an already-small source is never enlarged", async () => {
  const result = await solve(
    request({ width: 600, height: 400, targetBytes: 10_000_000 }),
    fakeEncode(0.8),
  );

  assert.equal(result.status, "ok");
  assert.ok(result.width <= 600 && result.height <= 400);
});