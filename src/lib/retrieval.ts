import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contextChunks } from "@/db/schema";
import { cosineSimilarity, embedQuery } from "@/lib/embeddings";

export interface RetrievedChunk {
  chunkId: number;
  sourceType: string;
  sourceId: number;
  text: string;
  score: number;
}

export async function retrieveContext(
  clientId: number,
  query: string,
  k = 8,
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedQuery(query);

  const chunks = await db.select().from(contextChunks).where(eq(contextChunks.clientId, clientId));

  return chunks
    .map((chunk) => ({
      chunkId: chunk.id,
      sourceType: chunk.sourceType,
      sourceId: chunk.sourceId,
      text: chunk.text,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
