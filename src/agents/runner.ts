import { Client } from 'pg';
import dotenv from 'dotenv';
import { EmailProcessingService } from '../services/email-processing.service';
import { processAllAccounts } from '../emailProcessor';
dotenv.config();

export class AgentRunner {
  private dbClient: Client;
  private intervalId: NodeJS.Timeout | null = null;
  private emailProcessor: EmailProcessingService;

  constructor() {
    const connection = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/email_rag';
    this.dbClient = new Client({ connectionString: connection });
    this.emailProcessor = new EmailProcessingService();
  }

  async start(intervalMinutes: number = 5) {
    await this.dbClient.connect();
    console.log('✓ Agent Runner connected to database');

    // Run immediately on start
    await this.runAllAgents();

    // Then run on interval
    this.intervalId = setInterval(async () => {
      await this.runAllAgents();
    }, intervalMinutes * 60 * 1000);

    console.log(`✓ Agent Runner scheduled to run every ${intervalMinutes} minutes`);
  }

  async stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    await this.dbClient.end();
    console.log('✓ Agent Runner stopped');
  }

  private async runAllAgents() {
    console.log('\n=== Running All Agents ===');
    const startTime = Date.now();

    try {
      // Run agents in sequence
      await this.runFetcher();
      await this.runOrchestrator();
      // Other agents are now integrated into Orchestrator/EmailProcessingService
      // await this.runClassifier(); 
      // await this.runGenerator();
      // await this.runMoMTracker();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`=== All Agents Completed in ${duration}s ===\n`);
    } catch (error) {
      console.error('Error running agents:', error);
    }
  }

  private async runFetcher() {
    console.log('[Fetcher] Starting...');
    try {
      await processAllAccounts();
    } catch (error) {
      console.error('[Fetcher] Error:', error);
    }
    console.log('[Fetcher] Completed');
  }

  private async runOrchestrator() {
    console.log('[Orchestrator] Starting...');
    
    // Find emails that don't have metadata (haven't been processed)
    const emails = await this.dbClient.query(`
      SELECT e.id FROM emails e
      LEFT JOIN email_meta m ON m.email_id = e.id
      WHERE m.id IS NULL
      LIMIT 10
    `);

    if (emails.rows.length === 0) {
      console.log('[Orchestrator] No new emails to process');
      return;
    }

    console.log(`[Orchestrator] Found ${emails.rows.length} new emails to process`);

    for (const e of emails.rows) {
      await this.emailProcessor.processEmail(e.id);
    }
    console.log('[Orchestrator] Completed');
  }

  // Legacy/Placeholder methods - kept for interface compatibility if needed, but unused
  private async runClassifier() {}
  private async runGenerator() {}
  private async runMoMTracker() {}

  getDbClient(): Client {
    return this.dbClient;
  }
}

// Standalone execution
import { fileURLToPath } from 'url';
const isMainModule = import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1]);

if (isMainModule) {
  const runner = new AgentRunner();
  runner.start().catch(err => {
    console.error('Failed to start agent runner:', err);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down agent runner...');
    await runner.stop();
    process.exit(0);
  });
}
