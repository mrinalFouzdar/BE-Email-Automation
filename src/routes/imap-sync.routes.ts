import { Router, Request, Response } from 'express';
import { runImapSyncJob } from '../jobs/imap-sync.job';
import { syncSingleImapAccount } from '../jobs/imap-sync-single.job';

const router = Router();

/**
 * @swagger
 * /api/imap-sync/run:
 *   post:
 *     summary: Manually trigger IMAP sync job
 *     description: Fetches unread emails from all IMAP accounts, classifies them with AI, and sets labels on mailbox
 *     tags: [IMAP Sync]
 *     responses:
 *       200:
 *         description: Sync job completed successfully
 *       500:
 *         description: Sync job failed
 */
router.post('/run', async (req: Request, res: Response) => {
  try {
    console.log('🔄 Manual IMAP sync triggered via API');

    // Run the sync job asynchronously
    runImapSyncJob()
      .then(() => {
        console.log('✅ Manual sync completed successfully');
      })
      .catch((error) => {
        console.error('❌ Manual sync failed:', error.message);
      });

    // Return immediately (don't wait for job to complete)
    res.json({
      success: true,
      message: 'IMAP sync job started. Check server logs for progress.'
    });
  } catch (error: any) {
    console.error('❌ Error triggering IMAP sync:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/imap-sync/account/{id}:
 *   post:
 *     summary: Sync specific IMAP account immediately
 *     description: Fetches unread emails, classifies with AI, and sets labels for a specific account
 *     tags: [IMAP Sync]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Account ID to sync
 *     responses:
 *       200:
 *         description: Sync completed
 *       404:
 *         description: Account not found
 */
router.post('/account/:id', async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.id);
    console.log(`🔄 Manual sync triggered for account ID: ${accountId}`);

    const result = await syncSingleImapAccount(accountId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Sync completed successfully',
        stats: result.stats
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('❌ Error syncing account:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/imap-sync/status:
 *   get:
 *     summary: Get IMAP sync status
 *     description: Returns information about IMAP accounts and last sync times
 *     tags: [IMAP Sync]
 *     responses:
 *       200:
 *         description: Status retrieved successfully
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { Client } = await import('pg');
    const connection = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/email_rag';
    const client = new Client({ connectionString: connection });

    await client.connect();

    // Get all IMAP accounts with sync info
    const result = await client.query(`
      SELECT
        id,
        email,
        account_name,
        status,
        auto_fetch,
        enable_ai_labeling,
        last_sync,
        created_at
      FROM email_accounts
      WHERE provider_type = 'imap'
      ORDER BY last_sync DESC NULLS LAST
    `);

    await client.end();

    res.json({
      success: true,
      accounts: result.rows,
      total: result.rows.length,
      active: result.rows.filter((a: any) => a.status === 'connected' && a.auto_fetch).length
    });
  } catch (error: any) {
    console.error('❌ Error getting IMAP sync status:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
