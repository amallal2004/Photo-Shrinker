import { CompressorPanel } from "@/components/CompressorPanel";

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
          Image compressor
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          That file is too big. Here&apos;s the fix.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-stone-600">
          Upload forms ask for a maximum file size in megabytes. Pick the limit your form
          states and we&apos;ll shrink the photo to land just under it — as a JPG, ready to upload.
        </p>
      </header>

      <div className="mt-10 sm:mt-12">
        <CompressorPanel />
      </div>

      <section className="mt-16 border-t border-stone-200 pt-10">
        <h2 className="text-sm font-semibold text-stone-900">How it works</h2>
        <ul className="mt-4 grid gap-6 text-sm leading-relaxed text-stone-600 sm:grid-cols-3">
          <li>
            <span className="font-medium text-stone-900">Everything is always JPG</span>
            <br />
            PNG isn&apos;t built for photographs. We output JPEG whatever you upload, and
            transparent backgrounds get filled so you don&apos;t get black rectangles.
          </li>
          <li>
            <span className="font-medium text-stone-900">It fits, or we tell you why</span>
            <br />
            If we can&apos;t hit your limit without making the photo too small for the form, we
            say so plainly instead of handing you a file that&apos;d get rejected.
          </li>
          <li>
            <span className="font-medium text-stone-900">Nothing leaves your device</span>
            <br />
            The whole process runs in this tab. Your photos are never sent to a server, which
            matters when they&apos;re passport or ID images.
          </li>
        </ul>
      </section>
    </main>
  );
}