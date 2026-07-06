import type { Metadata } from "next";
import Image from "next/image";
import { SiteFooter } from "@/components/site-footer";
import { RotatingWord } from "@/components/rotating-word";
import dawnMist from "../../public/images/background_2.jpg";
import hillTown from "../../public/images/background_1.jpeg";

export const metadata: Metadata = {
  title: "Analogue",
};

export default function Home() {
  return (
    <main className="bg-surface">
      <section className="relative min-h-screen overflow-hidden">
        <Image
          alt="Misty sunrise over the Val d'Orcia, Tuscany"
          src={dawnMist}
          placeholder="blur"
          preload
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="landing-scrim" />

        <div className="stagger absolute top-1/2 left-1/2 z-10 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 px-6 text-center text-[#fdf7e7]" style={{ textShadow: "0 1px 3px rgba(61, 52, 35, 0.45), 0 4px 24px rgba(61, 52, 35, 0.35)" }}>
          <p className="card-in font-display text-2xl leading-none md:text-3xl">The Modern Platform Powering</p>
          <p className="card-in mt-5 font-display text-4xl italic leading-none md:mt-8 md:text-5xl">
            <RotatingWord />
          </p>
          <p className="card-in mt-6 font-display text-2xl leading-none md:mt-10 md:text-3xl">Travel Designers</p>
        </div>

        <p className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-xs text-[#fdf7e7]/70">
          A working prototype — drafts, not blanks.
        </p>
      </section>

      <section id="how-it-works" className="px-6 py-16 md:px-10 md:py-24 scroll-mt-20">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">How the agents work</p>
            <h1 className="mt-4 max-w-xl font-display text-4xl leading-tight text-ink md:text-5xl">
              Three specialist agents prepare the work. The designer makes the call.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-ink-muted">
              Analogue reads the agency context, runs narrow checks, and returns reviewable output with flags when facts need a human eye.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
            {[
              {
                step: "01",
                title: "Draft reply",
                body: "Client threads are matched with preferences, notes, intake forms, and trip history. The agent writes in the designer's voice and flags any claim it cannot ground.",
              },
              {
                step: "02",
                title: "Parse quote",
                body: "Supplier emails become structured rate options: currency, amount, basis, inclusions, caveats, child policy, and hold expiry are extracted for comparison.",
              },
              {
                step: "03",
                title: "Surface next move",
                body: "The book of business is scanned for stale replies, expiring holds, unresolved details, and timely opportunities, with source references attached.",
              },
            ].map((agent) => (
              <article
                key={agent.step}
                className="rounded-lg border border-hairline bg-surface-raised p-5 shadow-float"
              >
                <div className="flex items-start gap-4">
                  <span className="font-mono text-xs text-accent">{agent.step}</span>
                  <div>
                    <h2 className="text-base font-semibold text-ink">{agent.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-ink-muted">{agent.body}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative h-[50vh] min-h-[320px] overflow-hidden md:h-[65vh]">
        <Image
          alt="Montepulciano rooftops above the Tuscan countryside at sunset"
          src={hillTown}
          placeholder="blur"
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-10 text-center">
          <p
            className="font-display text-2xl text-[#fdf7e7] italic md:text-3xl"
            style={{ textShadow: "0 1px 3px rgba(61, 52, 35, 0.5)" }}
          >
            Built for the designers who know the way.
          </p>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#4a3d24]/45 via-transparent to-transparent" />
      </section>

      <SiteFooter />
    </main>
  );
}
