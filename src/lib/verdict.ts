export interface VerdictInput {
  bytes: number;
  width: number;
  height: number;
  targetBytes: number;
  minWidth: number;
  minHeight: number;
  /** Set only in exact-dimension mode; otherwise the minimum-size rules apply. */
  exactWidth?: number | null;
  exactHeight?: number | null;
}

export type VerdictLevel = "pass" | "fail";

export interface Verdict {
  level: VerdictLevel;
  headline: string;
  /** Blocking problems. A portal will reject the upload for these. */
  failures: string[];
}

/** A downscale past this ratio is usually visible as softness. */
const SOFT_RATIO = 0.4;

function formatDelta(delta: number): string {
  const mb = delta / 1_000_000;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(delta / 1000)} KB`;
}

/**
 * Checks an encoded file against the rules a portal actually enforces.
 *
 * Both failure modes matter, and the second one is the one people miss:
 * shrinking until the file fits can leave an image that is now *too small* to
 * be a valid photo, which is rejected just as firmly as an oversize file.
 */
export function evaluate(input: VerdictInput): Verdict {
  const failures: string[] = [];

  const overBy = input.bytes - input.targetBytes;
  if (overBy > 0) {
    failures.push(`Over the limit by ${formatDelta(overBy)}.`);
  }

  if (input.exactWidth && input.exactHeight) {
    if (input.width !== input.exactWidth || input.height !== input.exactHeight) {
      failures.push(
        `Expected exactly ${input.exactWidth}×${input.exactHeight}px, produced ${input.width}×${input.height}px.`,
      );
    }
  } else {
    if (input.minWidth > 0 && input.width < input.minWidth) {
      failures.push(
        `Too small: ${input.width}px wide, but this form needs at least ${input.minWidth}px.`,
      );
    }
    if (input.minHeight > 0 && input.height < input.minHeight) {
      failures.push(
        `Too small: ${input.height}px tall, but this form needs at least ${input.minHeight}px.`,
      );
    }
  }

  if (failures.length > 0) {
    return { level: "fail", headline: "Will be rejected", failures };
  }
  return { level: "pass", headline: "Meets the requirement", failures };
}

/** Non-blocking quality note, shown separately from the pass/fail verdict. */
export function softnessNote(
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
): string | null {
  const sourcePixels = sourceWidth * sourceHeight;
  if (sourcePixels <= 0) return null;
  const ratio = (width * height) / sourcePixels;
  if (ratio >= SOFT_RATIO) return null;
  return `Scaled down to ${Math.round(ratio * 100)}% of the original pixels — fine for a printed photo, but don't zoom in.`;
}