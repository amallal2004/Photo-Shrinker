import { decodeFile, makeEncoder, type CanvasFactory, type CanvasLike } from "./jpeg";
import { solve } from "./solver";
import type { SolveOutcome, SolverProgress } from "./types";

export interface CompressOptions {
  targetBytes: number;
  minWidth: number;
  minHeight: number;
  maxLongEdge: number;
  exactWidth: number | null;
  exactHeight: number | null;
  background: string;
  onProgress?: (progress: SolverProgress) => void;
}

export interface CompressResult {
  blob: Blob;
  bytes: number;
  width: number;
  height: number;
  quality: number;
  status: SolveOutcome["status"];
  reason?: string;
  passes: number;
  sourceWidth: number;
  sourceHeight: number;
}

function mainThreadCanvas(): CanvasFactory {
  return (width, height) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas as unknown as CanvasLike;
  };
}

/**
 * Yields to the browser between encode attempts.
 *
 * `scheduler.yield()` resumes at higher priority than a timeout, so the UI
 * updates sooner; `setTimeout` is the fallback where it is unavailable.
 */
function yieldToBrowser(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (typeof scheduler?.yield === "function") {
    return scheduler.yield().catch(() => undefined);
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Compresses an image to JPEG, solving for the largest file that fits the
 * target byte limit.
 *
 * This runs on the main thread. Turbopack emits `new Worker(new URL(...))`
 * targets as raw untranspiled assets rather than bundling them, so a separate
 * worker file cannot import the solver without duplicating it; the solve is
 * instead broken into small yielding steps so the page stays responsive.
 */
export async function compressImage(
  file: Blob,
  options: CompressOptions,
): Promise<CompressResult> {
  const bitmap = await decodeFile(file);
  try {
    const encode = makeEncoder(
      bitmap,
      bitmap.width,
      bitmap.height,
      options.background,
      mainThreadCanvas(),
    );

    const outcome = await solve(
      {
        width: bitmap.width,
        height: bitmap.height,
        targetBytes: options.targetBytes,
        minWidth: options.minWidth,
        minHeight: options.minHeight,
        maxLongEdge: options.maxLongEdge,
        exactWidth: options.exactWidth,
        exactHeight: options.exactHeight,
        maxQuality: 0.95,
        minQuality: 0.3,
        referenceQuality: 0.75,
      },
      encode,
      options.onProgress,
      undefined,
      yieldToBrowser,
    );

    const { blob, ...rest } = outcome;
    return {
      ...rest,
      blob,
      sourceWidth: bitmap.width,
      sourceHeight: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}