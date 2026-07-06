import Link from "next/link";

export function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-hairline bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 md:px-10">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2A2018] ring-1 ring-white/20">
            <span className="font-display text-base text-[#FDF8F0]">A</span>
          </span>
          <span className="font-display text-base text-ink">Analogue</span>
        </Link>

        <div className="flex items-center gap-6">
          <a
            href="#how-it-works"
            className="hidden text-sm text-ink-muted transition-colors hover:text-ink md:inline"
          >
            How it works
          </a>
          <Link
            href="/today"
            className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-white shadow-float transition hover:brightness-105 active:scale-[0.98]"
          >
            Enter the studio →
          </Link>
        </div>
      </div>
    </header>
  );
}
