import cron, { ScheduledTask } from 'node-cron';
import { runImapSyncJob } from './imap-sync.job.js';
import { logger } from '../utils/logger.util.js';

/**
 * Email Sync Cron Job Service
 * Automatically syncs emails from IMAP accounts on a schedule
 *
 * Schedule Options (cron format):
 * - Every 5 minutes: star-slash-5 * * * *
 * - Every 15 minutes: star-slash-15 * * * *
 * - Every 30 minutes: star-slash-30 * * * *
 * - Every hour: 0 * * * *
 * - Every 2 hours: 0 star-slash-2 * * *
 * - Every day at midnight: 0 0 * * *
 *
 * Replace "star-slash" with asterisk followed by forward slash
 */

class EmailSyncCronService {
  private cronJob: ScheduledTask | null = null;
  private isRunning: boolean = false;
  private cronSchedule: string;

  constructor(schedule: string = '0 * * * *') { // Default: every hour
    this.cronSchedule = schedule;
  }

  /**
   * Start the cron job
   */
  start() {
    if (this.cronJob) {
      logger.warn('Email sync cron job is already running');
      return;
    }

    logger.info('🚀 Starting Email Sync Cron Service');
    logger.info(`📅 Schedule: ${this.cronSchedule} (${this.getScheduleDescription()})`);

    // Create and start cron job
    this.cronJob = cron.schedule(this.cronSchedule, async () => {
      await this.executeSync();
    });

    // Run immediately on startup (optional)
    const runOnStartup = process.env.RUN_SYNC_ON_STARTUP !== 'false';
    if (runOnStartup) {
      logger.info('▶️  Running initial sync on startup...');
      this.executeSync();
    }

    logger.info('✅ Email Sync Cron Service started successfully');
  }

  /**
   * Execute sync job with error handling
   */
  private async executeSync() {
    if (this.isRunning) {
      logger.warn('⚠️  Previous sync is still running, skipping this run');
      return;
    }

    this.isRunning = true;
    const startTime: number = Date.now();

    try {
      logger.info('\n⏰ Scheduled email sync triggered');
      await runImapSyncJob();
      const duration: number = (Date.now() - startTime) / 1000;
      logger.info(`✅ Email sync completed in ${duration.toFixed(2)}s`);
    } catch (error: any) {
      logger.error('❌ Email sync failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('🛑 Email Sync Cron Service stopped');
    }
  }

  /**
   * Get human-readable schedule description
   */
  private getScheduleDescription(): string {
    const scheduleMap: Record<string, string> = {
      ['*/5 * * * *']: 'Every 5 minutes',
      ['*/15 * * * *']: 'Every 15 minutes',
      ['*/30 * * * *']: 'Every 30 minutes',
      ['0 * * * *']: 'Every hour',
      ['0 */2 * * *']: 'Every 2 hours',
      ['0 */3 * * * ']: 'Every 3 hours',
      ['0 */6 * * *']: 'Every 6 hours',
      ['0 0 * * *']: 'Daily at midnight',
      ['0 9 * * *']: 'Daily at 9:00 AM',
      ['0 0 * * 1']: 'Weekly on Monday',
    };

    return scheduleMap[this.cronSchedule] || this.cronSchedule;
  }

  /**
   * Check if cron job is running
   */
  isActive(): boolean {
    return this.cronJob !== null;
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      active: this.isActive(),
      schedule: this.cronSchedule,
      description: this.getScheduleDescription(),
      currentlyRunning: this.isRunning,
    };
  }
}

// Create singleton instance
// You can change the schedule by setting EMAIL_SYNC_CRON_SCHEDULE env variable
// Examples:
//   EMAIL_SYNC_CRON_SCHEDULE="star/15 * * * *"  - Every 15 minutes (replace star with *)
//   EMAIL_SYNC_CRON_SCHEDULE="0 star/2 * * *"   - Every 2 hours (replace star with *)
const cronSchedule = process.env.EMAIL_SYNC_CRON_SCHEDULE || '0 * * * *'; // Default: hourly
export const emailSyncCron = new EmailSyncCronService(cronSchedule);

// Export functions for backward compatibility
export function startEmailSyncCron() {
  emailSyncCron.start();
}

export function stopEmailSyncCron() {
  emailSyncCron.stop();
}
