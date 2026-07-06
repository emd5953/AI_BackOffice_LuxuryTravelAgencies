import type { Metadata } from "next";
import { LandingHero } from "@/components/landing-hero";

export const metadata: Metadata = {
  title: "Analogue",
};

export default function Home() {
  return (
    <main>
      <LandingHero />
    </main>
  );
}
