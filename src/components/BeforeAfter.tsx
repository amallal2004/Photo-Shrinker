"use client";

import { useId, useState } from "react";

// These are in-memory blob: previews of the user's own file. There is no
// network fetch to optimise, and the clip-path overlay needs plain <img>
// positioning that <Image> would only complicate.
/* eslint-disable @next/next/no-img-element */

interface BeforeAfterProps {
  beforeUrl: string | null;
  afterUrl: string | null;
  beforeLabel: string;
  afterLabel: string;
  /** Rendered over the preview while a compression is in flight. */
  busy?: boolean;
}

/**
 * Draggable before/after comparison.
 *
 * The "after" image is clipped to the left of the handle, and a range input
 * sits behind it so keyboard and screen-reader users get a real control rather
 * than a mouse-only divider.
 */
export function BeforeAfter({
  beforeUrl,
  afterUrl,
  beforeLabel,
  afterLabel,
  busy = false,
}: BeforeAfterProps) {
  const [position, setPosition] = useState(50);
  const inputId = useId();

  const activeUrl = afterUrl ?? beforeUrl;
  if (!activeUrl) return null;

  return (
    <figure className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
      <div className="relative aspect-4/3 select-none sm:aspect-16/10">
        <img
          src={beforeUrl ?? activeUrl}
          alt={`Original — ${beforeLabel}`}
          className="absolute inset-0 h-full w-full object-contain"
        />

        {afterUrl && (
          <div
            className="absolute inset-0"
            style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          >
            <img
              src={afterUrl}
              alt={`Compressed — ${afterLabel}`}
              className="absolute inset-0 h-full w-full object-contain"
            />
          </div>
        )}

        {afterUrl && (
          <>
            <div
              className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
              style={{ left: `${position}%` }}
            />
            <div
              className="pointer-events-none absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md"
              style={{ left: `${position}%` }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-full w-full p-1.5 text-stone-700" aria-hidden="true">
                <path
                  d="M9 7l-4 5 4 5M15 7l4 5-4 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/65 px-2 py-1 text-xs font-medium text-white">
              Before
            </span>
            <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-teal-600/90 px-2 py-1 text-xs font-medium text-white">
              After
            </span>
          </>
        )}

        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[2px]">
            <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-stone-300 border-t-teal-600" />
              <span className="text-sm font-medium text-stone-700">Compressing…</span>
            </div>
          </div>
        )}

        <input
          id={inputId}
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          aria-label={`Compare original with compressed version. Currently showing ${position}% compressed.`}
          className="absolute inset-0 h-full w-full cursor-ew-resize appearance-none bg-transparent opacity-0"
        />
      </div>

      <figcaption className="flex justify-between gap-4 border-t border-stone-200 bg-white px-4 py-2 text-xs text-stone-500">
        <span className="truncate">{beforeLabel}</span>
        <span className="truncate text-right">{afterUrl ? afterLabel : "Compressed result"}</span>
      </figcaption>
    </figure>
  );
}