import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { importEml } from "./attachments";
import { normalizeWhatsApp } from "./connectors";
import { tripId } from "./imports";
import type { Trip } from "./types";

// Only CRM identity is seeded. Every operational field must come from raw evidence.
export async function extractionExample() {
  const folder = join(process.cwd(), "public/examples/extraction");
  const trip: Trip = {
    id: tripId("synthetic", "AT-JP-270314"),
    reference: "AT-JP-270314",
    title: "Reed · Kyoto private journey",
    traveler: "Alex & Jordan Reed",
    email: "alex@reed-example.invalid",
    phone: "+12025550145",
    environment: "synthetic",
  };
  const sources = [];
  for (const filename of ["ryokan-confirmation.eml", "tea-ceremony-hold.eml"]) {
    const parsed = await importEml(
      await readFile(join(folder, filename), "utf8"),
      filename,
      "synthetic",
    );
    sources.push(...parsed.sources);
  }
  const messages = JSON.parse(
    await readFile(join(folder, "whatsapp-messages.json"), "utf8"),
  ) as Record<string, string>[];
  for (const message of messages) {
    const result = normalizeWhatsApp(
      new URLSearchParams(message).toString(),
      "synthetic",
    );
    result.locator = `Synthetic WhatsApp fixture / ${message.MessageSid}`;
    sources.push(result);
  }
  for (const record of sources)
    record.warnings.push(
      "Synthetic test fixture. Invented evidence; not received from a real supplier or WhatsApp account.",
    );
  return { trips: [trip], sources };
}
