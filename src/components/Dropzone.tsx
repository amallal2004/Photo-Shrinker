"use client";

import { useCallback, useRef, useState } from "react";

interface DropzoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

const ACCEPTED = "image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp";

export function Dropzone({ onFile, disabled }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(event.dataTransfer.files);
      }}
      className={`rounded-2xl border-2 border-dashed p-10 text-center transition-colors sm:p-14 ${
        dragging
          ? "border-teal-500 bg-teal-50"
          : "border-stone-300 bg-white hover:border-stone-400"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          handleFiles(event.target.files);
          // Allow re-picking the same file after an error or a reset.
          event.target.value = "";
        }}
      />

      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-stone-500" aria-hidden="true">
          <path
            d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <p className="text-base font-medium text-stone-900">
        Drop your photo here
      </p>
      <p className="mt-1 text-sm text-stone-500">PNG, JPEG, WebP, GIF, AVIF or BMP</p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="mt-6 rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-700 disabled:opacity-50"
      >
        Choose a file
      </button>
    </div>
  );
}