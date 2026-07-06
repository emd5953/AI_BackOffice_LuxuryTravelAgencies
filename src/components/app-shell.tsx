"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { NAV_ITEMS } from "@/lib/nav-items";
import hillTown from "../../public/images/background_1.jpeg";

function isActive(pathname: string, href: string) {
  if (href === "/today") return pathname === "/today" || pathname.startsWith("/today/");
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (pathname === "/" || pathname === "/way") {
    return <>{children}</>;
  }

  return (
    <>
      <div className="studio-scene" aria-hidden="true">
        <Image
          alt=""
          src={hillTown}
          placeholder="blur"
          fill
          sizes="100vw"
          className="object-cover"
        />
      </div>

      <div className="fixed top-4 left-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-1 overflow-x-auto rounded-full bg-surface-raised px-2 py-1.5 shadow-float">
        <Link href="/today" className="shrink-0 px-2 font-display text-base text-ink">
          Analogue
        </Link>
        <span className="h-4 w-px shrink-0 bg-hairline" />
        <nav className="flex shrink-0 items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-ink-muted hover:bg-surface hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="fixed top-4 right-4 z-50 rounded-full bg-surface-raised px-4 py-2 text-xs text-ink-muted shadow-float">
        {today}
      </div>

      <main className="studio-fade mx-auto max-w-5xl px-6 pt-24 pb-16">{children}</main>
    </>
  );
}
