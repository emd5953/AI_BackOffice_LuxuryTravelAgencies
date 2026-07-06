"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import dawnMist from "../../public/images/background_2.jpg";
import { RotatingWord } from "./rotating-word";

const VEIL_MS = 1700;

type Stage = "hero" | "covering" | "intro" | "leaving";

export function LandingHero() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);
  const [stage, setStage] = useState<Stage>("hero");

  const veilOn = stage === "covering" || stage === "leaving";
  const busy = stage !== "hero";

  function enter() {
    if (busy) return;
    setStage("covering");
    setTimeout(() => {
      setStage("intro");
      const video = videoRef.current;
      if (!video) return;
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => onIntroEnded());
      });
    }, VEIL_MS);
  }

  function onIntroEnded() {
    setStage("leaving");
    setTimeout(() => router.push("/way"), VEIL_MS);
  }

  return (
    <section
      className={`relative min-h-screen overflow-hidden ${stage === "covering" ? "hero-leaving" : ""}`}
    >
      <div className="hero-photo absolute inset-0">
        <Image
          alt="Misty sunrise over the Val d'Orcia, Tuscany"
          src={dawnMist}
          placeholder="blur"
          preload
          fill
          sizes="100vw"
          className="object-cover"
        />
      </div>
      <div className="landing-scrim" />

      <div
        className="stagger absolute top-1/2 left-1/2 z-10 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 px-6 text-center text-[#fdf7e7]"
        style={{
          textShadow:
            "0 1px 3px rgba(61, 52, 35, 0.45), 0 4px 24px rgba(61, 52, 35, 0.35)",
        }}
      >
        <p className="card-in font-display text-2xl leading-none md:text-3xl">
          The Modern Platform Powering
        </p>
        <p className="card-in relative mt-5 font-display text-4xl italic leading-none md:mt-8 md:text-5xl">
          <button
            type="button"
            onClick={enter}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            aria-label="Enter — built for the designers who know the way"
            className="word-gateway inline-block"
          >
            <RotatingWord paused={hovered || busy} />
          </button>
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute top-[72%] left-1/2 -translate-x-[28%] bg-[#2a2114]/70 px-4 py-1.5 font-sans text-[11px] not-italic tracking-[0.28em] whitespace-nowrap text-[#fdf7e7]/90 uppercase backdrop-blur-sm transition-all duration-500 ease-out md:text-xs ${
              hovered && !busy
                ? "translate-y-0 opacity-100 delay-150"
                : "translate-y-2 opacity-0"
            }`}
          >
            Click. Turn Sound Up
          </span>
        </p>
        <p className="card-in mt-6 font-display text-2xl leading-none md:mt-10 md:text-3xl">
          Travel Designers
        </p>
      </div>

      <p className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-xs text-[#fdf7e7]/70">
        A working prototype — drafts, not blanks.
      </p>

      <div
        className={`absolute inset-0 z-30 bg-black transition-opacity duration-700 ${
          stage === "intro" || stage === "leaving"
            ? "opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      >
        <video
          ref={videoRef}
          src="/videos/analogue_intro.mp4"
          preload="auto"
          playsInline
          onEnded={onIntroEnded}
          className="pointer-events-none h-full w-full object-cover"
        />
      </div>

      <div className={`hero-veil ${veilOn ? "hero-veil-on" : ""}`} aria-hidden="true" />
    </section>
  );
}
