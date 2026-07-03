import type { quotes, trips } from "@/db/schema";

type Quote = typeof quotes.$inferSelect;
type Trip = typeof trips.$inferSelect;

export function nightsBetween(startDate: string, endDate: string): number {
  const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
  return Math.round(ms / 86_400_000);
}

export interface StayEstimate {
  totalUsd: number | null;
  formula: string;
  warnings: string[];
}

// The model extracts; this code computes. Estimates show their formula so a
// designer can check the arithmetic, and refuse to guess when the quote's
// shape makes the total genuinely ambiguous.
export function estimateStayTotal(quote: Quote, trip: Trip): StayEstimate {
  const warnings: string[] = [];

  if (quote.currency !== "USD") {
    return {
      totalUsd: null,
      formula: "—",
      warnings: [`Quoted in ${quote.currency}; convert before comparing`],
    };
  }
  if (!trip.startDate || !trip.endDate) {
    return { totalUsd: null, formula: "—", warnings: ["Trip dates not set"] };
  }

  const nights = nightsBetween(trip.startDate, trip.endDate);
  if (!Number.isFinite(nights) || nights <= 0) {
    return {
      totalUsd: null,
      formula: "—",
      warnings: ["Trip dates are invalid or zero nights — cannot estimate"],
    };
  }
  if (quote.minNights != null && nights < quote.minNights) {
    warnings.push(
      `Trip is ${nights} nights but supplier minimum is ${quote.minNights} — quote may not apply as-is`,
    );
  }

  const parts: string[] = [`$${quote.amount.toLocaleString()}`];
  let total = quote.amount;

  if (quote.unit === "per_night") {
    total *= nights;
    parts.push(`× ${nights} nights`);
  }

  switch (quote.scope) {
    case "per_person": {
      if (trip.partySize == null) {
        return {
          totalUsd: null,
          formula: "—",
          warnings: ["Party size unknown — cannot compute a per-person total"],
        };
      }
      total *= trip.partySize;
      parts.push(`× ${trip.partySize} pax`);
      warnings.push("Flat per-person math — child discounts NOT applied");
      break;
    }
    case "per_room": {
      if (trip.partySize == null) {
        return {
          totalUsd: null,
          formula: "—",
          warnings: ["Party size unknown — cannot estimate room count"],
        };
      }
      const rooms = Math.ceil(trip.partySize / 2);
      total *= rooms;
      parts.push(`× ${rooms} rooms`);
      warnings.push(
        `Room count estimated from party of ${trip.partySize} (2 per room) — not stated by supplier`,
      );
      break;
    }
    case "per_unit":
    case "whole_party":
      break;
  }

  if (quote.basis === "net") {
    warnings.push("NET rate — agency markup not included; not comparable to gross as-is");
  }
  if (
    quote.caveats.some((c) =>
      /promo|stay\s*\d+\s*pay\s*\d+|\bfree\b|complimentary|discount|% ?off/i.test(c),
    )
  ) {
    warnings.push("Possible discount/promo in caveats not applied to this estimate");
  }

  return { totalUsd: Math.round(total), formula: parts.join(" "), warnings };
}
