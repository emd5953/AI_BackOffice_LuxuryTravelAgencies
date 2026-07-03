import { VoyageAIClient } from "voyageai";

export const EMBEDDING_MODEL = "voyage-4";

// Lazy singleton: constructing the client reads VOYAGE_API_KEY, but pages
// that don't touch retrieval must still load without the key configured.
let client: VoyageAIClient | null = null;

function getClient(): VoyageAIClient {
  if (!client) {
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) throw new Error("VOYAGE_API_KEY is not set");
    client = new VoyageAIClient({ apiKey });
  }
  return client;
}

function orderByIndex(data: { embedding?: number[]; index?: number }[]): number[][] {
  return [...data]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((item) => {
      if (!item.embedding) throw new Error("Voyage response is missing an embedding");
      return item.embedding;
    });
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const response = await getClient().embed({
    input: texts,
    model: EMBEDDING_MODEL,
    inputType: "document",
  });
  return orderByIndex(response.data ?? []);
}

export async function embedQuery(text: string): Promise<number[]> {
  const response = await getClient().embed({
    input: [text],
    model: EMBEDDING_MODEL,
    inputType: "query",
  });
  const [embedding] = orderByIndex(response.data ?? []);
  if (!embedding) throw new Error("Voyage returned no embedding for the query");
  return embedding;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
