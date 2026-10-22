"use client";

import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", listener);
  return () => {
    observer.disconnect();
    query.removeEventListener("change", listener);
  };
}
function snapshot() {
  const theme = document.documentElement.dataset.theme;
  return theme
    ? theme === "dark"
    : window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, snapshot, () => false);

  function toggle() {
    const next = !dark;
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("analogue-theme", next ? "dark" : "light");
    } catch {
      /* Theme still applies when storage is unavailable. */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="theme-toggle fixed top-5 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-[#2a2114]/40 text-[#fdf7e7] shadow-float backdrop-blur-md transition-transform duration-300 ease-out hover:scale-110 active:scale-95"
    >
      <span className="relative block h-6 w-6">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={`absolute inset-0 transition-all duration-700 ease-out ${
            dark
              ? "scale-50 rotate-90 opacity-0"
              : "scale-100 rotate-0 opacity-100"
          }`}
        >
          <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" />
        </svg>
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`absolute inset-0 transition-all duration-700 ease-out ${
            dark
              ? "scale-100 rotate-0 opacity-100"
              : "scale-50 -rotate-90 opacity-0"
          }`}
        >
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
        </svg>
      </span>
    </button>
  );
}
