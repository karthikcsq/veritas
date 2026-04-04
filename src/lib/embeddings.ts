import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Embed a piece of text using OpenAI's text-embedding-3-small model.
 * Returns a 1536-dimension vector.
 */
export async function embedText(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: text.trim(),
    dimensions: 1024,
  });
  return response.data[0].embedding;
}
