import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

export class AgentRunner {
  private dbClient: Client;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    const connection = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/email_rag';
    this.dbClient = new Client({ connectionString: connection });
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
      await this.runClassifier();
      await this.runGenerator();
      await this.runMoMTracker();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`=== All Agents Completed in ${duration}s ===\n`);
    } catch (error) {
      console.error('Error running agents:', error);
    }
  }

  private async runFetcher() {
    console.log('[Fetcher] Starting...');
    // Import and run fetcher logic here
    // For now, placeholder
    console.log('[Fetcher] Completed');
  }

  private async runOrchestrator() {
    console.log('[Orchestrator] Starting...');
    const emails = await this.dbClient.query(`
      SELECT e.* FROM emails e
      LEFT JOIN email_meta m ON m.email_id = e.id
      WHERE m.id IS NULL
      LIMIT 10
    `);

    for (const e of emails.rows) {
      const subject = e.subject || '';
      const body = e.body || '';
      const is_meeting = /meeting|meet|call/i.test(subject + body);
      const is_escalation = /asap|urgent|immediately|escalation/i.test(subject + body);
      const is_hierarchy = /boss|manager|director|ceo/i.test(subject + body);
      const is_client = /client|customer|vendor/i.test(subject + body);
      const is_urgent = is_escalation || /urgent/i.test(subject + body);

      await this.dbClient.query(
        `INSERT INTO email_meta(email_id, is_meeting, is_escalation, is_hierarchy, is_client, is_urgent, classification)
         VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [e.id, is_meeting, is_escalation, is_hierarchy, is_client, is_urgent, JSON.stringify({ subject })]
      );
      console.log(`[Orchestrator] Classified email ${e.id}`);
    }
    console.log('[Orchestrator] Completed');
  }

  private async runClassifier() {
    console.log('[Classifier] Starting...');
    // Classifier logic will be imported
    console.log('[Classifier] Completed');
  }

  private async runGenerator() {
    console.log('[Generator] Starting...');
    // Generator logic will be imported
    console.log('[Generator] Completed');
  }

  private async runMoMTracker() {
    console.log('[MoMTracker] Starting...');
    // MoMTracker logic will be imported
    console.log('[MoMTracker] Completed');
  }

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
