"use client";

import { formatBytes, SIZE_PRESETS } from "@/lib/presets";

interface TargetPickerProps {
  presetId: string;
  onPresetChange: (id: string) => void;
  customMb: string;
  onCustomMbChange: (value: string) => void;
  useCustom: boolean;
  onUseCustomChange: (value: boolean) => void;
  minWidth: string;
  onMinWidthChange: (value: string) => void;
  minHeight: string;
  onMinHeightChange: (value: string) => void;
}

export function TargetPicker({
  presetId,
  onPresetChange,
  customMb,
  onCustomMbChange,
  useCustom,
  onUseCustomChange,
  minWidth,
  onMinWidthChange,
  minHeight,
  onMinHeightChange,
}: TargetPickerProps) {
  const activePreset = SIZE_PRESETS.find((p) => p.id === presetId);

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          What size does the form ask for?
        </legend>

        <div className="mt-3 flex flex-wrap gap-2">
          {SIZE_PRESETS.map((preset) => {
            const active = !useCustom && preset.id === presetId;
            return (
              <button
                key={preset.id}
                type="button"
                title={preset.hint}
                onClick={() => {
                  onUseCustomChange(false);
                  onPresetChange(preset.id);
                }}
                className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-teal-600 bg-teal-600 text-white"
                    : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
                }`}
              >
                {preset.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => onUseCustomChange(true)}
            className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
              useCustom
                ? "border-teal-600 bg-teal-600 text-white"
                : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
            }`}
          >
            My own limit
          </button>
        </div>

        {!useCustom && (
          <p className="mt-3 text-xs text-stone-500">
            {activePreset?.hint} ·{" "}
            <span className="tabular-nums">{formatBytes(activePreset?.maxBytes ?? 0, 0)}</span>{" "}
            ceiling
          </p>
        )}
      </fieldset>

      {useCustom && (
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <label htmlFor="custom-limit" className="block text-sm font-medium text-stone-900">
            Maximum file size
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              id="custom-limit"
              type="number"
              min={0.01}
              step={0.1}
              inputMode="decimal"
              value={customMb}
              onChange={(event) => onCustomMbChange(event.target.value)}
              placeholder="10"
              className="w-28 rounded-lg border border-stone-300 px-3 py-2 text-sm tabular-nums focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
            />
            <span className="text-sm text-stone-500">MB maximum</span>
          </div>
          <p className="mt-2 text-xs text-stone-500">
            Set this to the exact number printed on the form. We size the photo to land just
            under it.
          </p>
        </div>
      )}

      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          Smallest size the form accepts
        </legend>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={minWidth}
            onChange={(event) => onMinWidthChange(event.target.value)}
            placeholder="0"
            aria-label="Minimum width in pixels"
            className="w-24 rounded-lg border border-stone-300 px-3 py-2 text-sm tabular-nums focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
          />
          <span className="text-sm text-stone-500">×</span>
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={minHeight}
            onChange={(event) => onMinHeightChange(event.target.value)}
            placeholder="0"
            aria-label="Minimum height in pixels"
            className="w-24 rounded-lg border border-stone-300 px-3 py-2 text-sm tabular-nums focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
          />
          <span className="text-sm text-stone-500">px</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-stone-500">
          Leave at 0 unless the form asks for a minimum. If it does, we will not shrink the photo
          below it — an image that is too small gets rejected just as firmly as one that is too big.
        </p>
      </fieldset>
    </div>
  );
}