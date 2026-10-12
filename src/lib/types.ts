/** Shared types for the compression pipeline. */

export interface Dimensions {
  width: number;
  height: number;
}

/** The result of one JPEG encode attempt. */
export interface EncodeResult extends Dimensions {
  blob: Blob;
  bytes: number;
  quality: number;
}

export interface SolveRequest extends Dimensions {
  /** Hard ceiling the final file must fit under. */
  targetBytes: number;
  /**
   * Smallest output the destination portal will still accept, in pixels.
   * Downscaling past this produces a file that is "under the limit" but gets
   * rejected for being too small to be a valid photo.
   */
  minWidth: number;
  minHeight: number;
  /** Longest edge the output may have. 0 disables the cap. */
  maxLongEdge: number;
  /**
   * When both are set the output must be exactly these dimensions, so the
   * solver may only vary quality and can never rescue an over-budget file by
   * resizing.
   */
  exactWidth?: number | null;
  exactHeight?: number | null;
  maxQuality: number;
  minQuality: number;
  /** Quality used for the size-probing passes. */
  referenceQuality: number;
}

export type SolveStatus = "ok" | "impossible";

export interface SolveOutcome extends Dimensions {
  status: SolveStatus;
  blob: Blob;
  bytes: number;
  quality: number;
  /** Number of JPEG encodes performed. */
  passes: number;
  /** True when the smallest legal image still exceeds the target. */
  reason?: string;
}

/** Injectable encoder, so the solver can be tested without a canvas. */
export type EncodeFn = (
  width: number,
  height: number,
  quality: number,
) => Promise<EncodeResult>;

export interface SolverLimits {
  maxQuality: number;
  minQuality: number;
  referenceQuality: number;
  /** Tolerance for the quality binary search. */
  qualityEpsilon: number;
  maxScalePasses: number;
}

export const DEFAULT_LIMITS: SolverLimits = {
  maxQuality: 0.95,
  minQuality: 0.3,
  referenceQuality: 0.75,
  qualityEpsilon: 0.02,
  maxScalePasses: 5,
};

export type SolverPhase = "probing" | "scaling" | "tuning" | "done";

export interface SolverProgress {
  phase: SolverPhase;
  /** Bytes produced by the most recent encode. */
  bytes: number;
  targetBytes: number;
  width: number;
  height: number;
  quality: number;
  passes: number;
}

export type ProgressFn = (progress: SolverProgress) => void;