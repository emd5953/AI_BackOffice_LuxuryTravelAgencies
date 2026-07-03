"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV_ITEMS = [
  { href: "/today", label: "Today" },
  { href: "/inbox", label: "Inbox" },
  { href: "/clients", label: "Clients" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/today") return pathname === "/" || pathname.startsWith("/today");
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="shrink-0 border-b border-hairline bg-surface-raised md:w-52 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-4 p-5 md:block">
          <div>
            <p className="font-display text-sm tracking-[0.2em] text-ink">MERIDIAN</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
              Private Travel
            </p>
          </div>

          <nav className="flex items-center gap-4 md:mt-8 md:flex-col md:items-stretch md:gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors md:-mx-2 ${
                    active ? "text-accent" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <span
                    className={`hidden h-1 w-1 rounded-full md:inline-block ${
                      active ? "bg-accent" : "bg-transparent"
                    }`}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <div className="flex-1">
        <main className="mx-auto max-w-5xl px-6 py-10 md:px-10">{children}</main>
      </div>
    </div>
  );
}
