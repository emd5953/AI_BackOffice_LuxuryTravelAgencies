"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import dawnMist from "../../public/images/background_2.jpg";
import { RotatingWord } from "./rotating-word";
import { ThemeToggle } from "./theme-toggle";

const VEIL_MS = 1700;

const BIRD_SVG =
  '<svg viewBox="0 0 24 12" fill="currentColor"><path d="M12 7C9.5 2.5 6 1.5 1 4c4.5.5 7 2 9.5 6.5L12 12l1.5-1.5C16 6 18.5 4.5 23 4c-5-2.5-8.5-1.5-11 3z"/></svg>';

type Stage = "hero" | "covering" | "intro" | "leaving";

export function LandingHero() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const wordRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [stage, setStage] = useState<Stage>("hero");
  const [hint, setHint] = useState<{ x: number; y: number; text: string; leaving: boolean } | null>(null);
  const clickCount = useRef(0);
  const hintTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  function launchBird(sx: number, sy: number, ex: number, ey: number, duration: number) {
    const section = sectionRef.current;
    if (!section) return;
    const bird = document.createElement("span");
    bird.className = "hero-bird";
    bird.innerHTML = BIRD_SVG;
    section.appendChild(bird);

    const tilt = Math.max(-16, Math.min(16, ((ey - sy) / (ex - sx || 1)) * 20));
    const mx = sx + (ex - sx) * 0.5;
    const my = sy + (ey - sy) * 0.5 - 80;
    const anim = bird.animate(
      [
        { transform: `translate(${sx}px, ${sy}px) rotate(${tilt}deg)`, opacity: 0 },
        { opacity: 1, offset: 0.08 },
        { transform: `translate(${mx}px, ${my}px) rotate(${tilt / 2}deg)`, offset: 0.5 },
        { opacity: 1, offset: 0.88 },
        { transform: `translate(${ex}px, ${ey}px) rotate(0deg) scale(0.5)`, opacity: 0 },
      ],
      { duration, easing: "cubic-bezier(0.45, 0, 0.25, 1)" },
    );
    anim.onfinish = () => bird.remove();
  }

  function showHint(x: number, y: number, text: string) {
    hintTimers.current.forEach(clearTimeout);
    setHint({ x, y, text, leaving: false });
    hintTimers.current = [
      setTimeout(() => setHint((h) => (h ? { ...h, leaving: true } : h)), 4300),
      setTimeout(() => setHint(null), 5200),
    ];
  }

  function spawnBird(e: React.MouseEvent) {
    if (stage !== "hero") return;
    if ((e.target as HTMLElement).closest(".word-gateway, .theme-toggle")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const section = sectionRef.current;
    const word = wordRef.current;
    if (!section || !word) return;

    const rect = section.getBoundingClientRect();
    const w = word.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const ex = w.left + w.width / 2 - rect.left;
    const ey = w.top + w.height / 2 - rect.top - 8;

    for (let i = 0; i < 3; i++) {
      const jx = sx + (i === 0 ? 0 : i === 1 ? -42 : 38);
      const jy = sy + (i === 0 ? 0 : i === 1 ? 26 : -22);
      setTimeout(() => launchBird(jx, jy, ex, ey, 3400 + i * 300), i * 320);
    }

    clickCount.current += 1;
    if (clickCount.current === 3) showHint(sx, sy, "wonder where i'm flying to?");
    else if (clickCount.current === 6) showHint(sx, sy, "click on the center…?");
  }

  return (
    <section
      ref={sectionRef}
      onClick={spawnBird}
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
            ref={wordRef}
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

      {hint && (
        <span
          className={`hint-cloud ${hint.leaving ? "hint-cloud-leaving" : ""}`}
          style={{ left: hint.x, top: hint.y }}
        >
          {hint.text}
        </span>
      )}

      <div className={`hero-veil ${veilOn ? "hero-veil-on" : ""}`} aria-hidden="true" />

      {stage === "hero" && <ThemeToggle />}
    </section>
  );
}
