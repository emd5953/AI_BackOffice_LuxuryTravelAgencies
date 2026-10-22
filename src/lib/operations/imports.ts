import { parse } from "csv-parse/sync";
import { z } from "zod";
import { hash, source } from "./core";
import type { Environment, Fact, FactKey, Trip } from "./types";

const fields: Record<string, FactKey> = {
  check_in: "checkIn",
  check_out: "checkOut",
  party_size: "partySize",
  reservation_status: "reservationStatus",
  reservation_ref: "reservationRef",
  arrival_flight: "arrivalFlight",
  transfer_status: "transferStatus",
  payment_status: "paymentStatus",
  special_requests: "specialRequests",
};
const text = z.string().trim().max(500);
const rowSchema = z
  .object({
    trip_ref: text.min(1).regex(/^[A-Za-z0-9_-]+$/),
    title: text.min(1),
    traveler: text.min(1),
    email: z.union([z.email(), z.literal("")]).optional(),
    phone: z
      .string()
      .regex(/^\+[1-9]\d{6,14}$|^$/)
      .optional(),
    check_in: z.union([z.iso.date(), z.literal("")]).optional(),
    check_out: z.union([z.iso.date(), z.literal("")]).optional(),
    party_size: z
      .string()
      .regex(/^[1-9]\d{0,2}$|^$/)
      .optional(),
    reservation_status: text.optional(),
    reservation_ref: text.optional(),
    arrival_flight: text.optional(),
    transfer_status: text.optional(),
    payment_status: text.optional(),
    special_requests: text.optional(),
  })
  .strict();
export const tripId = (environment: Environment, reference: string) =>
  hash([environment, reference.toLowerCase()]).slice(0, 24);

export function importCsv(
  csv: string,
  filename: string,
  environment: Environment,
) {
  if (Buffer.byteLength(csv) > 500_000) throw new Error("CSV limit is 500 KB.");
  let headers: string[] = [];
  const rows = parse(csv, {
    bom: true,
    skip_empty_lines: true,
    trim: true,
    max_record_size: 20_000,
    columns: (values: string[]) => {
      headers = values;
      if (new Set(values).size !== values.length)
        throw new Error("CSV contains duplicate headers.");
      return values;
    },
  }) as Record<string, string>[];
  if (!rows.length || rows.length > 200)
    throw new Error("Import 1–200 CSV rows at a time.");
  if (!headers.includes("trip_ref"))
    throw new Error(
      "CSV must include trip_ref, title, and traveler columns. Use the template.",
    );
  const trips: Trip[] = [];
  const sources = rows.map((raw, i) => {
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success)
      throw new Error(
        `CSV row ${i + 2}: ${parsed.error.issues.map((e) => `${e.path.join(".") || "columns"}: ${e.message}`).join("; ")}`,
      );
    const row = parsed.data;
    if (row.check_in && row.check_out && row.check_in >= row.check_out)
      throw new Error(`CSV row ${i + 2}: check_out must follow check_in.`);
    const trip: Trip = {
      id: tripId(environment, row.trip_ref),
      reference: row.trip_ref,
      title: row.title,
      traveler: row.traveler,
      email: row.email || undefined,
      phone: row.phone || undefined,
      environment,
    };
    const existing = trips.find((t) => t.id === trip.id);
    if (existing && hash(existing) !== hash(trip))
      throw new Error(
        `CSV row ${i + 2}: conflicting trip identity for ${row.trip_ref}.`,
      );
    if (!existing) trips.push(trip);
    const facts: Fact[] = Object.entries(fields).flatMap(([column, key]) =>
      raw[column]
        ? [{ key, value: raw[column], excerpt: `${column}=${raw[column]}` }]
        : [],
    );
    return source({
      externalId: `${filename}:row:${i + 2}`,
      provider: "csv",
      environment,
      title: `${filename} · row ${i + 2}`,
      locator: `${filename} / row ${i + 2}`,
      occurredAt: null,
      content: JSON.stringify(raw, null, 2),
      facts,
      identifiers: { tripRef: row.trip_ref, email: row.email || undefined },
      warnings: [
        "Spreadsheet assertion; confirm against the supplier. Original row timestamp is unknown.",
      ],
    });
  });
  return { trips, sources };
}

// Conservative extraction only: free prose remains evidence, never silently turns into confirmed facts.
export function labeledFacts(body: string): Fact[] {
  return body.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([a-z_]+)\s*:\s*(.{1,500})\s*$/i);
    const key = match && fields[match[1].toLowerCase()];
    if (!match || !key) return [];
    const value = match[2].trim();
    if (
      ["checkIn", "checkOut"].includes(key) &&
      !z.iso.date().safeParse(value).success
    )
      return [];
    if (key === "partySize" && !/^[1-9]\d{0,2}$/.test(value)) return [];
    return [{ key, value, excerpt: line }];
  });
}
export function tripReference(body: string) {
  return body.match(
    /(?:^|\n)\s*trip_ref\s*:\s*([A-Za-z0-9_-]+)\s*(?:\n|$)/i,
  )?.[1];
}

export const CSV_TEMPLATE =
  "trip_ref,title,traveler,email,phone,check_in,check_out,party_size,reservation_ref,reservation_status,arrival_flight,transfer_status,payment_status,special_requests\n";
export const SAMPLE_CSV =
  CSV_TEMPLATE +
  "SYN-KYO-01,Reed · Kyoto & Naoshima,Alex Reed,alex@example.invalid,+12025550123,2027-03-15,2027-03-19,2,SYN-RYOKAN-84,confirmed,,requested,pending,Quiet room\n";

export function syntheticExample() {
  const { trips, sources } = importCsv(
    SAMPLE_CSV,
    "SYNTHETIC-reservations.csv",
    "synthetic",
  );
  const input = [
    {
      provider: "gmail" as const,
      externalId: "synthetic-email-1",
      title: "Supplier email · Kyoto stay",
      locator: "Synthetic fixture / supplier-email.txt",
      body: "Dear Maya,\n\nDelighted to confirm the garden suite for Alex Reed and guest, arriving 14 March 2027 and departing 19 March 2027. Your confirmation is SYN-RYOKAN-84.\n\nBreakfast is included. Please send the arrival flight before we confirm the transfer. The deposit is still outstanding.\n\nWarm regards,\nYuki · Sample Ryokan reservations\n\ntrip_ref: SYN-KYO-01",
    },
    {
      provider: "gmail" as const,
      externalId: "synthetic-attachment-1",
      title: "Attachment · arrival instructions.txt",
      locator: "Synthetic fixture / supplier-email / arrival-instructions.txt",
      body: "Arrival instructions for the Reed party\n\nDriver allocation requires the arrival flight. These are instructions, not a confirmed transfer voucher. Please advise luggage count and whether a child seat is required.\n\ntrip_ref: SYN-KYO-01",
    },
    {
      provider: "whatsapp" as const,
      externalId: "synthetic-whatsapp-1",
      title: "WhatsApp · traveler request",
      locator: "Synthetic fixture / WhatsApp message 1",
      body: "Hey Maya! Could you confirm whether the ryokan can arrange feather-free bedding? And can we arrive a day earlier? We haven't selected our flight yet. Thanks!\n\ntrip_ref: SYN-KYO-01",
    },
    {
      provider: "whatsapp" as const,
      externalId: "synthetic-unmatched",
      title: "WhatsApp · reference missing",
      locator: "Synthetic fixture / WhatsApp message 2",
      body: "Could you move our arrival by one day?",
    },
  ];
  sources.push(
    ...input.map((s) =>
      source({
        provider: s.provider,
        externalId: s.externalId,
        title: s.title,
        locator: s.locator,
        environment: "synthetic",
        occurredAt: "2026-10-22T14:00:00Z",
        content: s.body,
        facts: [],
        identifiers: { tripRef: tripReference(s.body) },
        warnings: [
          "Synthetic test fixture. No provider or AI was contacted. Interpret the original message before recording fields.",
        ],
      }),
    ),
  );
  return { trips, sources };
}
