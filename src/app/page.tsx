import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Analogue",
};

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="landing-sky" />
      <div className="landing-glow" />
      <div className="landing-hill-1" />
      <div className="landing-hill-2" />
      <div className="landing-hill-3" />
      <div className="landing-fog" />

      <div className="relative z-10 flex items-center gap-3 px-6 pt-6 md:px-10 md:pt-8">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2A2018] ring-1 ring-white/20">
          <span className="font-display text-lg text-[#FDF8F0]">A</span>
        </div>
        <div className="flex flex-col leading-tight text-[#FDF8F0] drop-shadow-sm">
          <span className="text-xs font-medium tracking-wide">Analogue</span>
          <span className="text-xs tracking-wide">Back office</span>
        </div>
      </div>

      <Link
        href="/today"
        className="absolute top-6 right-6 z-10 text-sm tracking-wide text-[#FDF8F0]/90 transition-colors hover:text-white md:top-8 md:right-10"
      >
        Enter the studio →
      </Link>

      <div className="stagger absolute top-1/2 left-1/2 z-10 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 px-6 text-center text-[#FDF8F0]" style={{ textShadow: "0 2px 20px rgba(42, 32, 24, 0.25)" }}>
        <p className="card-in font-display text-3xl md:text-5xl">The back office for</p>
        <p className="card-in font-display text-5xl italic md:text-7xl">meticulous</p>
        <p className="card-in font-display text-3xl md:text-5xl">travel designers</p>
        <p className="card-in mx-auto mt-6 max-w-md font-sans text-sm text-[#FDF8F0]/85 md:text-base">
          Every reply drafted, every quote parsed, every deadline surfaced. The designer keeps
          the send button.
        </p>
        <div className="card-in mt-8 flex items-center justify-center gap-6">
          <Link
            href="/today"
            className="rounded-full bg-ink/90 px-6 py-2.5 text-[#FDF8F0] shadow-lift backdrop-blur transition-colors hover:bg-ink"
          >
            Enter the studio
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-[#FDF8F0]/80 transition-colors hover:text-white"
          >
            See operations →
          </Link>
        </div>
      </div>

      <p className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-xs text-[#FDF8F0]/70">
        A working prototype — drafts, not blanks.
      </p>
    </div>
  );
}
