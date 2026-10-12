import {
  DEFAULT_LIMITS,
  type Dimensions,
  type EncodeFn,
  type EncodeResult,
  type ProgressFn,
  type SolveOutcome,
  type SolveRequest,
  type SolverLimits,
  type SolverPhase,
} from "./types";

/** JPEG uses 4:2:0 chroma subsampling; odd dimensions cause edge artifacts. */
const EVEN = 2;

/**
 * Absolute floor on the long edge. Without it an unconstrained target (no
 * minimum-size requirement) lets the search collapse to a 2×2 thumbnail that
 * trivially satisfies any byte limit.
 */
const ABS_MIN_LONG_EDGE = 32;

function toEven(n: number, mode: "floor" | "ceil"): number {
  const v = Math.round(n);
  const snapped = mode === "floor" ? v - (v % EVEN) : v + (EVEN - (v % EVEN)) % EVEN;
  return Math.max(EVEN, snapped);
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/** Largest scale (≤ 1) allowed by the long-edge cap. */
export function maxScaleFor(request: SolveRequest): number {
  const { width, height, maxLongEdge } = request;
  if (!maxLongEdge) return 1;
  return Math.min(1, maxLongEdge / Math.max(width, height));
}

/** Smallest scale that still satisfies the portal's minimum pixel rules. */
export function minScaleFor(request: SolveRequest): number {
  const { width, height, minWidth, minHeight } = request;
  const sx = minWidth > 0 ? minWidth / width : 0;
  const sy = minHeight > 0 ? minHeight / height : 0;
  return Math.max(sx, sy);
}

export function dimensionsAt(
  request: SolveRequest,
  scale: number,
  mode: "floor" | "ceil" = "floor",
): Dimensions {
  const cap = request.maxLongEdge;
  let width = toEven(request.width * scale, mode);
  let height = toEven(request.height * scale, mode);

  if (cap) {
    const longest = Math.max(width, height);
    if (longest > cap) {
      const ratio = cap / longest;
      width = toEven(width * ratio, "floor");
      height = toEven(height * ratio, "floor");
    }
  }
  return { width, height };
}

type Measure = (
  width: number,
  height: number,
  quality: number,
  phase: SolverPhase,
) => Promise<EncodeResult>;

/**
 * Finds the highest-quality JPEG that fits under `targetBytes` without
 * violating the portal's minimum pixel requirements.
 *
 * JPEG output size is close to linear in pixel count at a fixed quality, which
 * makes a single square-root estimate a good first guess. We then correct with
 * a few damped iterations and, once the budget is met, binary-search the
 * quality back *up* so we never ship a needlessly soft image.
 */
export async function solve(
  request: SolveRequest,
  encode: EncodeFn,
  onProgress?: ProgressFn,
  limits: SolverLimits = DEFAULT_LIMITS,
  yieldFn?: () => Promise<void>,
): Promise<SolveOutcome> {
  const { targetBytes } = request;
  let passes = 0;

  const measure: Measure = async (width, height, quality, phase) => {
    // Hand the main thread back between attempts so the progress UI can paint.
    // Encoding is synchronous under the hood, so without this the whole solve
    // blocks in one long task.
    await yieldFn?.();

    const result = await encode(width, height, quality);
    passes += 1;
    onProgress?.({
      phase,
      bytes: result.bytes,
      targetBytes,
      width,
      height,
      quality,
      passes,
    });
    return result;
  };

  const toOutcome = (result: EncodeResult, status: SolveOutcome["status"], reason?: string): SolveOutcome => ({
    status,
    blob: result.blob,
    bytes: result.bytes,
    quality: result.quality,
    width: result.width,
    height: result.height,
    passes,
    reason,
  });

  const sMax = maxScaleFor(request);
  // The two bounds can conflict (a portal demanding both a long-edge cap and a
  // minimum width larger than that cap allows). Clamp so the search always has
  // a legal range; the caller surfaces the conflict as a warning.
  const absoluteFloor = ABS_MIN_LONG_EDGE / Math.max(request.width, request.height);
  const sMin = Math.min(Math.max(minScaleFor(request), absoluteFloor), sMax);

  // Exact-size mode: the portal dictates the pixel dimensions, so quality is
  // the only lever left and some files simply cannot fit.
  const exact =
    request.exactWidth && request.exactHeight
      ? { width: request.exactWidth, height: request.exactHeight }
      : null;

  if (exact) {
    const probe = await measure(
      exact.width,
      exact.height,
      limits.referenceQuality,
      "probing",
    );

    if (probe.bytes <= targetBytes) {
      return toOutcome(await tuneQuality(request, measure, exact, probe, limits), "ok");
    }

    const lowest = await measure(exact.width, exact.height, limits.minQuality, "scaling");
    if (lowest.bytes > targetBytes) {
      return toOutcome(
        lowest,
        "impossible",
        `${exact.width}×${exact.height} at the lowest acceptable quality is still too large for this limit.`,
      );
    }
    return toOutcome(await tuneQuality(request, measure, exact, lowest, limits), "ok");
  }

  // Phase 1 — can we keep full resolution and just lower quality?
  const full = dimensionsAt(request, sMax);
  const probe = await measure(full.width, full.height, limits.referenceQuality, "probing");

  if (probe.bytes <= targetBytes) {
    const tuned = await tuneQuality(request, measure, full, probe, limits);
    return toOutcome(tuned, "ok");
  }

  // Phase 2 — estimate the scale needed, then correct with damped iterations.
  let scale = clamp(Math.sqrt(targetBytes / probe.bytes), sMin, sMax);
  let best: EncodeResult | null = null;

  for (let i = 0; i < limits.maxScalePasses; i += 1) {
    const dims = dimensionsAt(request, scale);
    const result = await measure(dims.width, dims.height, limits.referenceQuality, "scaling");

    if (result.bytes <= targetBytes) {
      best = result;
      break;
    }

    const next = clamp(scale * Math.sqrt(targetBytes / result.bytes) * 0.95, sMin, sMax);
    // Only give up when the correction stops moving the scale — i.e. we are
    // pinned against the floor and further shrinking is not permitted.
    if ((scale - next) / scale < 1e-3) break;
    scale = next;
  }

  if (!best) {
    // The floor is the smallest image the portal accepts. See whether even the
    // lowest acceptable quality fits before declaring the request impossible.
    const floor = dimensionsAt(request, sMin);
    const lowest = await measure(floor.width, floor.height, limits.minQuality, "scaling");

    if (lowest.bytes > targetBytes) {
      return toOutcome(
        lowest,
        "impossible",
        `Even at ${floor.width}×${floor.height} and quality ${Math.round(
          limits.minQuality * 100,
        )}%, the file is still too large for this limit.`,
      );
    }

    return toOutcome(await tuneQuality(request, measure, floor, lowest, limits), "ok");
  }

  const dims: Dimensions = { width: best.width, height: best.height };
  return toOutcome(await tuneQuality(request, measure, dims, best, limits), "ok");
}

/**
 * Binary-searches the highest quality that still fits at a fixed resolution.
 * `known` must already be a passing encode, and anchors the low end of the search.
 */
async function tuneQuality(
  request: SolveRequest,
  measure: Measure,
  dims: Dimensions,
  known: EncodeResult,
  limits: SolverLimits,
): Promise<EncodeResult> {
  let best = known;
  let low = known.quality;
  let high = Math.max(limits.maxQuality, known.quality);

  while (high - low > limits.qualityEpsilon) {
    const mid = (low + high) / 2;
    const result = await measure(dims.width, dims.height, mid, "tuning");

    if (result.bytes <= request.targetBytes) {
      best = result;
      low = mid;
    } else {
      high = mid;
    }
  }
  return best;
}