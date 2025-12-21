import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/email_rag';

export const client = new Client({
  connectionString,
});

let isConnected = false;

export async function connect() {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
    console.log('✅ Legacy database client connected');
  }
}

// Auto-connect on first use
export async function ensureConnected() {
  if (!isConnected) {
    await connect();
  }
}

// Auto-connect when module loads (for background jobs and services)
connect().catch(err => {
  console.warn('⚠️  Legacy database client auto-connect failed:', err.message);
  console.warn('   Will retry on first query...');
});
