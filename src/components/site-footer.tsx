import Link from "next/link";
import { NAV_ITEMS } from "@/lib/nav-items";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-[#211a10] text-[#f2e6cb]">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-[-0.35em] select-none text-center font-display text-[22vw] leading-none font-medium text-[#f2e6cb]/5"
      >
        Analogue
      </span>

      <div className="relative mx-auto max-w-6xl px-6 py-16 md:px-10 md:py-24">
        <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="font-display text-lg">Analogue</p>
            <p className="mt-1 text-sm text-[#f2e6cb]/60">
              AI back office for luxury travel designers.
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#f2e6cb]/50">
              Product
            </p>
            <nav className="mt-4 flex flex-col gap-2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-[#f2e6cb]/70 transition-colors hover:text-[#f2e6cb]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-16 border-t border-[#3e3521] pt-6 text-center text-xs text-[#f2e6cb]/50">
          © {new Date().getFullYear()} Analogue — drafts, not blanks.
        </div>
      </div>
    </footer>
  );
}
