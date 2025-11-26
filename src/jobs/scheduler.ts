import { runImapSyncJob } from './imap-sync.job';

/**
 * IMAP Sync Job Scheduler
 * Runs the IMAP sync job every 1 hour
 */
export function startImapSyncScheduler() {
  console.log('📅 Starting IMAP Sync Scheduler...');
  console.log('⏱️  Job will run every 1 hour');

  // Run immediately on startup
  console.log('▶️  Running initial sync...');
  runImapSyncJob().catch((error) => {
    console.error('❌ Initial sync failed:', error.message);
  });

  // Schedule to run every 1 hour (3600000 ms)
  const intervalMs = 60 * 60 * 1000; // 1 hour

  setInterval(() => {
    console.log('\n⏰ Scheduled IMAP sync triggered');
    runImapSyncJob().catch((error) => {
      console.error('❌ Scheduled sync failed:', error.message);
    });
  }, intervalMs);

  console.log('✅ IMAP Sync Scheduler started successfully\n');
}

/**
 * Stop the scheduler (for graceful shutdown)
 */
export function stopImapSyncScheduler() {
  console.log('🛑 Stopping IMAP Sync Scheduler...');
  // Node.js will automatically clear intervals on process exit
}
