
import dotenv from 'dotenv';
dotenv.config();
import app from './app';
import { connect } from './config/db';
import { AgentRunner } from './agents/runner';
import { runMigrations } from './migrate';
import { startImapSyncScheduler, stopImapSyncScheduler } from './jobs/scheduler';

// import processEmails from './emailProcessor';

const port = process.env.PORT || 4000;
const agentRunner = new AgentRunner();

async function startServer() {
  try {
    // 1. Connect to database
    await connect();
    console.log('✓ Connected to database');

    // 2. Run migrations automatically
    console.log('');
    await runMigrations(false); // false = don't create new connection
    console.log('');

    // 3. Start the Express API server
    app.listen(port, () => {
      console.log(`✓ Backend API listening on ${port}`)
      // processEmails()
    });

    // 4. Start the agent runner (runs agents every 5 minutes)
    const runAgents = process.env.RUN_AGENTS !== 'false'; // Default: true
    if (runAgents) {
      const agentInterval = parseInt(process.env.AGENT_INTERVAL_MINUTES || '5');
      await agentRunner.start(agentInterval);
    } else {
      console.log('⚠️  Agent runner disabled (set RUN_AGENTS=true to enable)');
    }

    // 5. Start IMAP Sync Scheduler (runs every 1 hour for IMAP accounts only)
    const runImapSync = process.env.RUN_IMAP_SYNC !== 'false'; // Default: true
    if (runImapSync) {
      startImapSyncScheduler();
    } else {
      console.log('⚠️  IMAP Sync Scheduler disabled (set RUN_IMAP_SYNC=true to enable)');
    }

    console.log('');
    console.log('====================================');
    console.log('🚀 Backend is ready!');
    console.log('====================================');
    console.log(`📡 API: http://localhost:${port}`);
    console.log(`📚 Docs: http://localhost:${port}/api-docs`);
    console.log('====================================');
    console.log('');

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server...');
  await agentRunner.stop();
  stopImapSyncScheduler();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down server...');
  await agentRunner.stop();
  stopImapSyncScheduler();
  process.exit(0);
});
