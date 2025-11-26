import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export async function embedText(text) {
    const resp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text });
    return resp.data[0].embedding;
}
