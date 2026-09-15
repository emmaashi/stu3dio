"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import FilmPlayer from "@/components/FilmPlayer";

function FilmPageContent() {
  const searchParams = useSearchParams();
  
  // Default to a working, freely-hosted film (old gtv-videos-bucket URLs now 403).
  const defaultSrc = "https://archive.org/download/Sintel/sintel-2048-surround.mp4";
  const src = searchParams.get("src") || defaultSrc;
  const autoplay = searchParams.get("autoplay") === "1";
  const rate = parseFloat(searchParams.get("rate") || "1");
  
  return (
    <div className="min-h-screen bg-black">
      <FilmPlayer
        src={src}
        autoplay={autoplay}
        initialRate={rate}
      />
    </div>
  );
}

export default function FilmPage() {
  return (
    <Suspense fallback={null}>
      <FilmPageContent />
    </Suspense>
  );
}
