import type { EncodeFn, EncodeResult } from "./types";

/**
 * The bits of the canvas API that differ between a worker (OffscreenCanvas)
 * and the main thread (HTMLCanvasElement).
 */
export interface Canvas2D {
  width: number;
  height: number;
  drawImage(
    source: CanvasImageSource,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  imageSmoothingEnabled: boolean;
  imageSmoothingQuality: "low" | "medium" | "high";
  fillStyle: string | CanvasGradient | CanvasPattern;
}

export interface CanvasLike {
  width: number;
  height: number;
  getContext(id: "2d"): Canvas2D | null;
  convertToBlob?(options: { type: string; quality?: number }): Promise<Blob>;
  toBlob?(
    callback: (blob: Blob | null) => void,
    type?: string,
    quality?: number,
  ): void;
}

export type CanvasFactory = (width: number, height: number) => CanvasLike;

export function makeEncoder(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  background: string,
  makeCanvas: CanvasFactory,
): EncodeFn {
  let scratch: CanvasLike | null = null;
  let scratchCtx: Canvas2D | null = null;

  const allocateScratch = (width: number, height: number): Canvas2D => {
    if (!scratch || !scratchCtx) {
      scratch = makeCanvas(width, height);
      scratchCtx = scratch.getContext("2d");
      if (!scratchCtx) throw new Error("2D canvas context unavailable");
    } else {
      // Assigning width/height resets the bitmap and its contents.
      scratch.width = width;
      scratch.height = height;
    }
    scratchCtx.imageSmoothingEnabled = true;
    scratchCtx.imageSmoothingQuality = "high";
    return scratchCtx;
  };

  /**
   * Draws the source into `ctx` at the requested size.
   *
   * Downscaling in a single drawImage call aliases badly on large reductions,
   * because the browser averages only a limited neighbourhood per destination
   * pixel. Halving repeatedly and filtering at each step gives a much cleaner
   * result, which matters a lot for the passport-photo use case where the face
   * is small in frame and gets scaled down hard.
   *
   * Alpha is preserved through the intermediate steps and flattened onto the
   * background only once, at the end — flattening per step would double-blend
   * semi-transparent edges and leave dark fringes.
   */
  const drawScaled = (ctx: Canvas2D, width: number, height: number): void => {
    let current: CanvasImageSource = source;
    let currentWidth = sourceWidth;
    let currentHeight = sourceHeight;

    while (currentWidth > width * 2 && currentHeight > height * 2) {
      const nextWidth = Math.max(width, Math.floor(currentWidth / 2));
      const nextHeight = Math.max(height, Math.floor(currentHeight / 2));
      const stepCtx = allocateScratch(nextWidth, nextHeight);
      stepCtx.clearRect(0, 0, nextWidth, nextHeight);
      stepCtx.drawImage(current, 0, 0, nextWidth, nextHeight);
      // CanvasLike is structurally a subset of the canvas types that
      // CanvasImageSource accepts, so the cast is safe in both runtimes.
      current = scratch as unknown as CanvasImageSource;
      currentWidth = nextWidth;
      currentHeight = nextHeight;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(current, 0, 0, width, height);
  };

  const toBlob = (canvas: CanvasLike, quality: number): Promise<Blob> => {
    if (canvas.convertToBlob) {
      return canvas.convertToBlob({ type: "image/jpeg", quality });
    }
    if (canvas.toBlob) {
      return new Promise((resolve, reject) => {
        canvas.toBlob!((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas failed to produce a JPEG"));
        }, "image/jpeg", quality);
      });
    }
    return Promise.reject(new Error("No canvas blob encoder available"));
  };

  return async (width, height, quality): Promise<EncodeResult> => {
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");

    // JPEG has no alpha channel. Without this fill, transparent PNG regions
    // composite as black and the user gets black rectangles where there should
    // be background.
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    drawScaled(ctx, width, height);

    const blob = await toBlob(canvas, quality);
    return { width, height, quality, blob, bytes: blob.size };
  };
}

/** Decodes a file to an ImageBitmap, honouring EXIF orientation. */
export async function decodeFile(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

/** True when the container may carry an alpha channel worth flattening. */
export function mayHaveAlpha(type: string): boolean {
  return ["image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml"].includes(
    type.toLowerCase(),
  );
}