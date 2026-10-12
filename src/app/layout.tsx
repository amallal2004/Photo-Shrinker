import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Photo Shrinker — fit your image to a government upload limit",
  description:
    "Paste the megabyte limit from any upload form and get a JPG that fits. Runs entirely in your browser; your photos are never uploaded.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-stone-50 text-stone-900 antialiased">{children}</body>
    </html>
  );
}