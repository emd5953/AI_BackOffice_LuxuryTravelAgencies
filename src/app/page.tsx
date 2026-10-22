import type { Metadata } from "next";
import { LandingHero } from "@/components/landing-hero";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Analogue",
};

export default function Home() {
  return (
    <main>
      <Link
        href="/operations"
        className="fixed left-6 top-6 z-50 rounded-full bg-surface-raised px-5 py-3 text-sm text-ink shadow-float"
      >
        Open conversation desk ↗
      </Link>
      <LandingHero />
    </main>
  );
}
