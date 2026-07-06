import Link from "next/link";
import { NAV_ITEMS } from "@/lib/nav-items";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-[#1b1611] text-[#f0e7da]">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-[-0.35em] select-none text-center font-display text-[22vw] leading-none font-medium text-[#f0e7da]/5"
      >
        Analogue
      </span>

      <div className="relative mx-auto max-w-6xl px-6 py-16 md:px-10 md:py-24">
        <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr]">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2A2018] ring-1 ring-white/20">
              <span className="font-display text-lg text-[#FDF8F0]">A</span>
            </span>
            <div>
              <p className="font-display text-lg">Analogue</p>
              <p className="mt-1 text-sm text-[#f0e7da]/60">
                AI back office for luxury travel designers.
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#f0e7da]/50">
              Product
            </p>
            <nav className="mt-4 flex flex-col gap-2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-[#f0e7da]/70 transition-colors hover:text-[#f0e7da]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-16 border-t border-[#3a3128] pt-6 text-center text-xs text-[#f0e7da]/50">
          © {new Date().getFullYear()} Analogue — drafts, not blanks.
        </div>
      </div>
    </footer>
  );
}
