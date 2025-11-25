"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRunner = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class AgentRunner {
    constructor() {
        this.intervalId = null;
        const connection = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/email_rag';
        this.dbClient = new pg_1.Client({ connectionString: connection });
    }
    async start(intervalMinutes = 5) {
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
    async runAllAgents() {
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
        }
        catch (error) {
            console.error('Error running agents:', error);
        }
    }
    async runFetcher() {
        console.log('[Fetcher] Starting...');
        // Import and run fetcher logic here
        // For now, placeholder
        console.log('[Fetcher] Completed');
    }
    async runOrchestrator() {
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
            await this.dbClient.query(`INSERT INTO email_meta(email_id, is_meeting, is_escalation, is_hierarchy, is_client, is_urgent, classification)
         VALUES($1,$2,$3,$4,$5,$6,$7)`, [e.id, is_meeting, is_escalation, is_hierarchy, is_client, is_urgent, JSON.stringify({ subject })]);
            console.log(`[Orchestrator] Classified email ${e.id}`);
        }
        console.log('[Orchestrator] Completed');
    }
    async runClassifier() {
        console.log('[Classifier] Starting...');
        // Classifier logic will be imported
        console.log('[Classifier] Completed');
    }
    async runGenerator() {
        console.log('[Generator] Starting...');
        // Generator logic will be imported
        console.log('[Generator] Completed');
    }
    async runMoMTracker() {
        console.log('[MoMTracker] Starting...');
        // MoMTracker logic will be imported
        console.log('[MoMTracker] Completed');
    }
    getDbClient() {
        return this.dbClient;
    }
}
exports.AgentRunner = AgentRunner;
// Standalone execution
if (require.main === module) {
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
