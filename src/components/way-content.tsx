"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const FADE_MS = 900;

export function WayContent() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  function openStudio(e: React.MouseEvent) {
    e.preventDefault();
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => router.push("/today"), FADE_MS);
  }

  return (
    <div
      className={`absolute inset-x-0 bottom-[14vh] z-10 px-6 text-center transition-opacity duration-[900ms] ease-out ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <p
        className="way-tagline font-display text-3xl text-[#fdf7e7] italic md:text-4xl"
        style={{ textShadow: "0 1px 3px rgba(61, 52, 35, 0.5)" }}
      >
        Built for the designers who know the way.
      </p>
      <a
        href="/today"
        onClick={openStudio}
        className="way-enter mt-8 inline-block font-display text-lg text-[#fdf7e7]/85 transition-colors duration-300 hover:text-[#fdf7e7] md:text-xl"
        style={{ textShadow: "0 1px 3px rgba(61, 52, 35, 0.5)" }}
      >
        open the studio{" "}
        <span className="way-enter-arrow inline-block transition-transform duration-300">
          →
        </span>
      </a>
    </div>
  );
}
