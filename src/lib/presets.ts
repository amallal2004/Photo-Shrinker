export interface Preset {
  id: string;
  label: string;
  /** Short hint about where this number comes from. */
  hint: string;
  /** Upper bound in bytes. */
  maxBytes: number;
  /** Portal-specific pixel floor, or 0 when the portal states none. */
  minWidth: number;
  minHeight: number;
  /** Fixed output dimensions the portal demands, or null for "any". */
  exactWidth: number | null;
  exactHeight: number | null;
  /** Physical print size the portal expects, when it states one. */
  printSizeMm: { width: number; height: number } | null;
}

export const MB = 1_000_000;
export const KB = 1_000;

/**
 * Byte ceilings that appear on real upload forms. These vary by portal and
 * change over time, so the UI always displays the value in use and lets the
 * user enter their own.
 *
 * Only file-size limits live here. Aspect-ratio and crop requirements (35×45mm,
 * 2×2in, and so on) are deliberately excluded: this tool resizes and recompresses
 * but never crops, so advertising a photo preset would promise framing it does
 * not deliver. Minimum pixel rules, which this tool *can* honour, are exposed as
 * an optional field in the custom panel instead.
 */
export const SIZE_PRESETS: Preset[] = [
  {
    id: "under-1mb",
    label: "Under 1 MB",
    hint: "Tight upload forms — DV lottery, some visa applications",
    maxBytes: 1 * MB,
    minWidth: 0,
    minHeight: 0,
    exactWidth: null,
    exactHeight: null,
    printSizeMm: null,
  },
  {
    id: "under-2mb",
    label: "Under 2 MB",
    hint: "Schengen visa photo uploads",
    maxBytes: 2 * MB,
    minWidth: 0,
    minHeight: 0,
    exactWidth: null,
    exactHeight: null,
    printSizeMm: null,
  },
  {
    id: "under-5mb",
    label: "Under 5 MB",
    hint: "Common e-passport and national ID uploads",
    maxBytes: 5 * MB,
    minWidth: 0,
    minHeight: 0,
    exactWidth: null,
    exactHeight: null,
    printSizeMm: null,
  },
  {
    id: "under-10mb",
    label: "Under 10 MB",
    hint: "Most government portals default to this",
    maxBytes: 10 * MB,
    minWidth: 0,
    minHeight: 0,
    exactWidth: null,
    exactHeight: null,
    printSizeMm: null,
  },
  {
    id: "under-240kb",
    label: "Under 240 KB",
    hint: "US visa and passport upload ceilings",
    maxBytes: 240 * KB,
    minWidth: 0,
    minHeight: 0,
    exactWidth: null,
    exactHeight: null,
    printSizeMm: null,
  },
];

export const DEFAULT_PRESET_ID = "under-10mb";

export function findPreset(id: string): Preset | undefined {
  return SIZE_PRESETS.find((p) => p.id === id);
}

/** Human-facing size label, e.g. "10 MB" or "512 KB". */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(bytes < 100 * KB ? 0 : decimals)} KB`;
  const mb = bytes / MB;
  if (mb < 10) return `${mb.toFixed(decimals)} MB`;
  if (mb < 1000) return `${mb.toFixed(0)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

/** How much smaller the output is than the input, as a percentage. */
export function savingsPercent(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.max(0, Math.round((1 - after / before) * 100));
}