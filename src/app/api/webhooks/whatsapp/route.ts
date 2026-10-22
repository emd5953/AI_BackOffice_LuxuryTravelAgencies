import { readLimited } from "@/lib/operations/auth";
import { normalizeWhatsApp, verifyTwilio } from "@/lib/operations/connectors";
import { mutate } from "@/lib/operations/store";
import { ingest } from "@/lib/operations/core";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const {
    TWILIO_AUTH_TOKEN: token,
    TWILIO_ACCOUNT_SID: account,
    TWILIO_WEBHOOK_URL: url,
    TWILIO_WHATSAPP_TO: to,
    WHATSAPP_ENVIRONMENT: environment,
  } = process.env;
  if (
    !token ||
    !account ||
    !url ||
    !to ||
    !["sandbox", "live"].includes(environment || "")
  )
    return new Response("WhatsApp integration is not configured", {
      status: 503,
    });
  if (
    !request.headers
      .get("content-type")
      ?.startsWith("application/x-www-form-urlencoded")
  )
    return new Response("Expected form encoding", { status: 415 });
  try {
    const raw = await readLimited(request, 100_000);
    if (
      !verifyTwilio(raw, request.headers.get("x-twilio-signature"), url, token)
    )
      return new Response("Invalid signature", { status: 403 });
    const p = new URLSearchParams(raw);
    if (p.get("AccountSid") !== account || p.get("To") !== to)
      return new Response("Wrong account or recipient", { status: 403 });
    mutate((state) =>
      ingest(state, [
        normalizeWhatsApp(raw, environment as "sandbox" | "live"),
      ]),
    );
    // Empty TwiML explicitly sends no reply.
    return new Response("<Response/>", {
      headers: { "Content-Type": "text/xml" },
    });
  } catch {
    return new Response("Unable to ingest webhook. No reply sent.", {
      status: 400,
    });
  }
}
