"use client";

import { useEffect, useState } from "react";

interface Step {
  at: number;
  label: string;
}

function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

export function AgentProgress({
  title,
  etaMs,
  steps,
}: {
  title: string;
  etaMs: number;
  steps: Step[];
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Date.now() - start);
    }, 250);
    return () => clearInterval(interval);
  }, []);

  const fraction = Math.min(1 - Math.exp(-elapsed / etaMs), 0.95);
  const phase = [...steps].reverse().find((s) => s.at <= fraction) ?? steps[0];
  const isSlow = elapsed > etaMs * 1.5;

  return (
    <div className="card-in fixed right-4 bottom-4 z-50 w-72 rounded-2xl border border-hairline/60 bg-surface-raised p-4 shadow-lift">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="motion-safe:animate-pulse h-2 w-2 shrink-0 rounded-full bg-accent" />
          <span className="truncate text-sm font-medium text-ink">{title}</span>
        </div>
        <span className="shrink-0 text-xs tabular-nums text-ink-muted">
          {formatElapsed(elapsed)}
        </span>
      </div>

      {phase && <p className="mt-2 text-xs text-ink-muted">{phase.label}</p>}

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-hairline">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>

      <p className="mt-2 text-[10px] text-ink-muted">
        {isSlow
          ? "Taking longer than usual — still working…"
          : `Usually ~${Math.round(etaMs / 1000)}s · live timings from agent telemetry`}
      </p>
    </div>
  );
}
