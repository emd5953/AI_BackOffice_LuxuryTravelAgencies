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
  const parts: string[] = [`$${quote.amount.toLocaleString()}`];
  let total = quote.amount;

  if (quote.unit === "per_night") {
    total *= nights;
    parts.push(`× ${nights} nights`);
  }

  switch (quote.scope) {
    case "per_person": {
      const party = trip.partySize ?? 1;
      total *= party;
      parts.push(`× ${party} pax`);
      warnings.push("Flat per-person math — child discounts NOT applied");
      break;
    }
    case "per_room":
      total *= 2;
      parts.push("× 2 rooms (assumed for party of 4)");
      warnings.push("Room count assumed, not stated per-party");
      break;
    case "per_unit":
    case "whole_party":
      break;
  }

  if (quote.basis === "net") {
    warnings.push("NET rate — agency markup not included; not comparable to gross as-is");
  }
  if (quote.caveats.some((c) => /stay\s*10\s*pay\s*9|promo/i.test(c))) {
    warnings.push("Promo mentioned in caveats not applied to this estimate");
  }

  return { totalUsd: Math.round(total), formula: parts.join(" "), warnings };
}
