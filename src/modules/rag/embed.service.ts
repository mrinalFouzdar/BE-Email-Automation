// COMMENTED OUT - Using local LLM instead of OpenAI
// import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embedText(text:string) {
  // COMMENTED OUT - OpenAI embeddings disabled
  // const resp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text });
  // return resp.data[0].embedding;

  // Return null for now (embeddings disabled)
  console.warn('⚠️  Embeddings are disabled (was using OpenAI, now using local LLM for classification only)');
  return null;
}
