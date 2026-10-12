"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BeforeAfter } from "./BeforeAfter";
import { Dropzone } from "./Dropzone";
import { TargetPicker } from "./TargetPicker";
import { compressImage, type CompressResult } from "@/lib/compressor";
import { mayHaveAlpha } from "@/lib/jpeg";
import { DEFAULT_PRESET_ID, findPreset, formatBytes, savingsPercent } from "@/lib/presets";
import type { SolverProgress } from "@/lib/types";
import { evaluate, softnessNote } from "@/lib/verdict";

/** Above this long edge no portal needs the extra pixels, and encodes get slow. */
const MAX_LONG_EDGE = 6000;

type Status = "idle" | "working" | "done" | "error";

interface Target {
  maxBytes: number;
  minWidth: number;
  minHeight: number;
  label: string;
}

/** Pure derivation of the active limit, shared by display and by compression. */
function resolveTarget(
  presetId: string,
  useCustom: boolean,
  customMb: string,
  minWidth: number,
  minHeight: number,
): Target {
  const maxBytes = (() => {
    if (useCustom) {
      const mb = Number.parseFloat(customMb);
      return Number.isFinite(mb) && mb > 0 ? Math.round(mb * 1_000_000) : 0;
    }
    return findPreset(presetId)?.maxBytes ?? 10_000_000;
  })();

  const label = useCustom
    ? maxBytes
      ? `Under ${formatBytes(maxBytes, 0)}`
      : "No limit set"
    : (findPreset(presetId)?.label ?? "Under 10 MB");

  return { maxBytes, minWidth, minHeight, label };
}

/** Parses an optional pixel floor, treating blank/invalid input as "no floor". */
function parsePixels(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Owns an object URL for a blob, revoking the previous one on every swap.
 *
 * The URL is created at the point the blob is produced — in an event handler
 * or a promise callback — rather than inside an effect, so React never has to
 * re-render just to create it.
 */
function useObjectUrl(): [string | null, (blob: Blob | null) => void] {
  const current = useRef<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (current.current) URL.revokeObjectURL(current.current);
    },
    [],
  );

  const swap = useCallback((blob: Blob | null) => {
    if (current.current) URL.revokeObjectURL(current.current);
    const next = blob ? URL.createObjectURL(blob) : null;
    current.current = next;
    setUrl(next);
  }, []);

  return [url, swap];
}

export function CompressorPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID);
  const [useCustom, setUseCustom] = useState(false);
  const [customMb, setCustomMb] = useState("10");
  const [minWidthInput, setMinWidthInput] = useState("");
  const [minHeightInput, setMinHeightInput] = useState("");
  const [background, setBackground] = useState("#ffffff");

  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState<SolverProgress | null>(null);
  const [result, setResult] = useState<CompressResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [originalUrl, setOriginalUrl] = useObjectUrl();
  const [resultUrl, setResultUrl] = useObjectUrl();

  const minW = parsePixels(minWidthInput);
  const minH = parsePixels(minHeightInput);

  /** Guards against an earlier compression landing after a newer one. */
  const runId = useRef(0);

  const runCompression = useCallback(
    (source: File, target: Target, bg: string) => {
      if (target.maxBytes <= 0) {
        setStatus("idle");
        return;
      }

      const id = ++runId.current;
      setStatus("working");
      setError(null);
      setProgress(null);

      compressImage(source, {
          targetBytes: target.maxBytes,
          minWidth: target.minWidth,
          minHeight: target.minHeight,
          maxLongEdge: MAX_LONG_EDGE,
          // Exact-dimension mode is supported by the solver but not surfaced in
          // the UI: forcing exact pixels without cropping would distort the
          // photo, which is worse than leaving the framing to the user.
          exactWidth: null,
          exactHeight: null,
          background: bg,
          onProgress: (next) => {
            if (runId.current === id) setProgress(next);
          },
        })
        .then((outcome) => {
          if (runId.current !== id) return;
          setResult(outcome);
          setResultUrl(outcome.blob);
          setStatus("done");
        })
        .catch((cause: unknown) => {
          if (runId.current !== id) return;
          setResult(null);
          setResultUrl(null);
          setError(cause instanceof Error ? cause.message : "Something went wrong");
          setStatus("error");
        });
    },
    [setResultUrl],
  );

  const target = useMemo(
    () => resolveTarget(presetId, useCustom, customMb, minW, minH),
    [presetId, useCustom, customMb, minW, minH],
  );

  const handleFile = useCallback(
    (next: File) => {
      if (!next.type.startsWith("image/")) return;
      setFile(next);
      setResult(null);
      setResultUrl(null);
      setError(null);
      setOriginalUrl(next);
      runCompression(
        next,
        resolveTarget(presetId, useCustom, customMb, minW, minH),
        background,
      );
    },
    [
      presetId,
      useCustom,
      customMb,
      minW,
      minH,
      background,
      runCompression,
      setOriginalUrl,
      setResultUrl,
    ],
  );

  const handlePresetChange = useCallback(
    (id: string) => {
      setPresetId(id);
      setUseCustom(false);
      if (file) {
        runCompression(file, resolveTarget(id, false, customMb, minW, minH), background);
      }
    },
    [file, customMb, minW, minH, background, runCompression],
  );

  const handleUseCustomChange = useCallback(
    (value: boolean) => {
      setUseCustom(value);
      if (file) {
        runCompression(file, resolveTarget(presetId, value, customMb, minW, minH), background);
      }
    },
    [file, presetId, customMb, minW, minH, background, runCompression],
  );

  const handleCustomMbChange = useCallback(
    (value: string) => {
      setCustomMb(value);
      if (file && useCustom) {
        runCompression(file, resolveTarget(presetId, true, value, minW, minH), background);
      }
    },
    [file, useCustom, presetId, minW, minH, background, runCompression],
  );

  const handleMinDimensionChange = useCallback(
    (which: "width" | "height", value: string) => {
      if (which === "width") setMinWidthInput(value);
      else setMinHeightInput(value);

      const nextMinW = which === "width" ? parsePixels(value) : minW;
      const nextMinH = which === "height" ? parsePixels(value) : minH;
      if (file) {
        runCompression(
          file,
          resolveTarget(presetId, useCustom, customMb, nextMinW, nextMinH),
          background,
        );
      }
    },
    [file, presetId, useCustom, customMb, minW, minH, background, runCompression],
  );

  const handleBackgroundChange = useCallback(
    (value: string) => {
      setBackground(value);
      if (file) {
        runCompression(
          file,
          resolveTarget(presetId, useCustom, customMb, minW, minH),
          value,
        );
      }
    },
    [file, presetId, useCustom, customMb, minW, minH, runCompression],
  );

  const reset = useCallback(() => {
    // Invalidate any compression still in flight.
    runId.current += 1;
    setFile(null);
    setResult(null);
    setResultUrl(null);
    setOriginalUrl(null);
    setError(null);
    setProgress(null);
    setStatus("idle");
  }, [setOriginalUrl, setResultUrl]);

  const verdict = useMemo(() => {
    if (!result) return null;
    return evaluate({
      bytes: result.bytes,
      width: result.width,
      height: result.height,
      targetBytes: target.maxBytes,
      minWidth: target.minWidth,
      minHeight: target.minHeight,
    });
  }, [result, target]);

  const note = useMemo(() => {
    if (!result) return null;
    return softnessNote(result.sourceWidth, result.sourceHeight, result.width, result.height);
  }, [result]);

  const downloadName = useMemo(() => {
    if (!file) return "compressed.jpg";
    const base = file.name.replace(/\.[^.]+$/, "") || "image";
    return `${base}.jpg`;
  }, [file]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
      <div className="min-w-0">
        {!file ? (
          <Dropzone onFile={handleFile} />
        ) : (
          <div className="space-y-4">
            <BeforeAfter
              beforeUrl={originalUrl}
              afterUrl={resultUrl}
              busy={status === "working"}
              beforeLabel={`${file.name} · ${formatBytes(file.size)}`}
              afterLabel={
                result
                  ? `${result.width}×${result.height} · ${formatBytes(result.bytes)}`
                  : "Compressed result"
              }
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:border-stone-400"
              >
                Use a different photo
              </button>

              {result && (
                <a
                  href={resultUrl ?? "#"}
                  download={downloadName}
                  className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
                    verdict?.level === "fail"
                      ? "bg-stone-400 hover:bg-stone-500"
                      : "bg-teal-600 hover:bg-teal-700"
                  }`}
                >
                  Download JPG
                </a>
              )}
            </div>

            {mayHaveAlpha(file.type) && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-4">
                <label htmlFor="bg-color" className="text-sm font-medium text-stone-900">
                  Transparent areas become
                </label>
                <input
                  id="bg-color"
                  type="color"
                  value={background}
                  onChange={(event) => handleBackgroundChange(event.target.value)}
                  className="h-8 w-12 cursor-pointer rounded border border-stone-300"
                />
                <p className="flex-1 basis-full text-xs text-stone-500">
                  JPEG cannot store transparency. See-through backgrounds are filled with this
                  colour instead of turning black.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <aside className="space-y-6 lg:sticky lg:top-8 lg:self-start">
        <TargetPicker
          presetId={presetId}
          onPresetChange={handlePresetChange}
          customMb={customMb}
          onCustomMbChange={handleCustomMbChange}
          useCustom={useCustom}
          onUseCustomChange={handleUseCustomChange}
          minWidth={minWidthInput}
          onMinWidthChange={(value) => handleMinDimensionChange("width", value)}
          minHeight={minHeightInput}
          onMinHeightChange={(value) => handleMinDimensionChange("height", value)}
        />

        {!file && (
          <p className="rounded-xl bg-stone-100 px-4 py-3 text-sm text-stone-600">
            Pick a photo to see whether it fits.
          </p>
        )}

        {file && status === "idle" && target.maxBytes <= 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Enter a size limit to start compressing.
          </div>
        )}

        {status === "working" && progress && (
          <ProgressCard progress={progress} label={target.label} />
        )}

        {status === "error" && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-900">Could not compress that file</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        )}

        {status === "done" && result && (
          <ResultCard
            result={result}
            originalBytes={file?.size ?? 0}
            target={target}
            verdict={verdict}
            note={note}
          />
        )}
      </aside>
    </div>
  );
}

function ProgressCard({ progress, label }: { progress: SolverProgress; label: string }) {
  const ratio = Math.min(1, progress.bytes / progress.targetBytes);
  const phaseLabel: Record<SolverProgress["phase"], string> = {
    probing: "Checking the original",
    scaling: "Finding the right size",
    tuning: "Maximising quality",
    done: "Finishing up",
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-stone-900">{phaseLabel[progress.phase]}</p>
        <span className="text-xs tabular-nums text-stone-500">{label}</span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${
            ratio > 1 ? "bg-amber-500" : "bg-teal-600"
          }`}
          style={{ width: `${Math.max(6, ratio * 100)}%` }}
        />
      </div>

      <p className="mt-3 text-xs tabular-nums text-stone-500">
        {progress.width}×{progress.height} · quality {Math.round(progress.quality * 100)}% ·{" "}
        {formatBytes(progress.bytes)}
      </p>
    </div>
  );
}

function ResultCard({
  result,
  originalBytes,
  target,
  verdict,
  note,
}: {
  result: CompressResult;
  originalBytes: number;
  target: Target;
  verdict: ReturnType<typeof evaluate> | null;
  note: string | null;
}) {
  const savings = savingsPercent(originalBytes, result.bytes);
  const passed = verdict?.level === "pass";

  return (
    <div className="space-y-4">
      <div
        className={`rounded-xl border p-4 ${
          passed ? "border-teal-200 bg-teal-50" : "border-red-200 bg-red-50"
        }`}
      >
        <div className="flex items-start gap-2.5">
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
              passed ? "bg-teal-600" : "bg-red-600"
            }`}
            aria-hidden="true"
          >
            {passed ? "✓" : "!"}
          </span>
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${passed ? "text-teal-900" : "text-red-900"}`}>
              {verdict?.headline}
            </p>
            {verdict && verdict.failures.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {verdict.failures.map((failure) => (
                  <li key={failure} className="text-xs leading-relaxed text-red-800">
                    {failure}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <dl className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
        <Row label="Original" value={formatBytes(originalBytes)} />
        <Row label="Compressed" value={formatBytes(result.bytes)} strong />
        <Row
          label="Saved"
          value={savings > 0 ? `${savings}% smaller` : "No change"}
          accent={savings > 0}
        />
        <Row label="Size" value={`${result.width} × ${result.height} px`} />
        <Row label="Quality" value={`${Math.round(result.quality * 100)}%`} />
        <Row label="Target" value={target.label} />
      </dl>

      {note && <p className="text-xs leading-relaxed text-stone-500">{note}</p>}

      <p className="text-xs text-stone-400">
        Processed entirely in your browser. Nothing was uploaded.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
  accent = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <dt className="text-sm text-stone-500">{label}</dt>
      <dd
        className={`text-sm tabular-nums ${
          accent
            ? "font-medium text-teal-700"
            : strong
              ? "font-semibold text-stone-900"
              : "text-stone-700"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}