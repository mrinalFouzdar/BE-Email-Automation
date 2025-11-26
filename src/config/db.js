import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/email_rag';
export const client = new Client({
    connectionString,
});
export async function connect() {
    await client.connect();
}
