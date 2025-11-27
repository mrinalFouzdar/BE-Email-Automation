import { Client } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../utils';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5433/email_rag';

export class Database {
  private static instance: Database;
  public client: Client;

  private constructor() {
    this.client = new Client({ connectionString });
  }

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('✅ Database connected successfully');
    } catch (error) {
      logger.error('❌ Database connection failed', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.end();
      logger.info('Database disconnected');
    } catch (error) {
      logger.error('Error disconnecting from database', error);
    }
  }

  getClient(): Client {
    return this.client;
  }
}

// Export singleton instance
export const database = Database.getInstance();
export const db = database.getClient();
