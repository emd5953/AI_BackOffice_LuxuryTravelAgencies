import { createHash, timingSafeEqual } from "node:crypto";

export function accessError(request: Request): Response | null {
  const secret = process.env.OPS_ACCESS_TOKEN;
  if (!secret || secret.length < 32) {
    if (
      process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(
        new URL(request.url).hostname,
      ) &&
      !secret
    )
      return null;
    return new Response(
      "Configure OPS_ACCESS_TOKEN with at least 32 characters before hosting this private workspace.",
      { status: 503 },
    );
  }
  const auth = request.headers.get("authorization") || "";
  let supplied = "";
  if (auth.startsWith("Bearer ")) supplied = auth.slice(7);
  if (auth.startsWith("Basic ")) {
    const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
    supplied = decoded.slice(decoded.indexOf(":") + 1);
  }
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(secret), digest(supplied))
    ? null
    : new Response("Private agency workspace", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Analogue pilot", charset="UTF-8"',
        },
      });
}
export function mutationError(request: Request) {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  // Next may reconstruct request.url with "localhost" while the browser uses 127.0.0.1.
  // Host is browser-controlled only by navigation, unlike arbitrary forwarded-host values.
  const expectedOrigin = `${requestUrl.protocol}//${request.headers.get("host") || requestUrl.host}`;
  if (origin && origin !== expectedOrigin)
    return new Response("Cross-origin mutations are not allowed.", {
      status: 403,
    });
  if (request.headers.get("sec-fetch-site") === "cross-site")
    return new Response("Cross-site mutation blocked.", { status: 403 });
  return accessError(request);
}
export async function readLimited(request: Request, maxBytes = 1_500_000) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("Import too large. Limit is 1 MB per file.");
    }
    chunks.push(part.value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
