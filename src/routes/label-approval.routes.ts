import { Router } from 'express';
import { Client } from 'pg';

const router = Router();
const connection = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/email_rag';

/**
 * GET /api/labels/pending
 * Get all labels pending approval
 */
router.get('/pending', async (req, res) => {
  const client = new Client({ connectionString: connection });

  try {
    await client.connect();

    // Get unapproved labels with email count
    const result = await client.query(`
      SELECT 
        l.id,
        l.name,
        l.color,
        l.is_system,
        l.is_approved,
        COUNT(DISTINCT el.email_id) as email_count
      FROM labels l
      LEFT JOIN email_labels el ON l.id = el.label_id
      WHERE l.is_approved = FALSE
      GROUP BY l.id, l.name, l.color, l.is_system, l.is_approved
      ORDER BY email_count DESC, l.name ASC
    `);

    await client.end();
    res.json({ pending: result.rows });
  } catch (error: any) {
    console.error('Error fetching pending labels:', error);
    await client.end();
    res.status(500).json({ error: 'Failed to fetch pending labels' });
  }
});

/**
 * POST /api/labels/approve
 * Approve a label for IMAP sync
 */
router.post('/approve', async (req, res) => {
  const { label_id } = req.body;

  if (!label_id) {
    return res.status(400).json({ error: 'label_id is required' });
  }

  const client = new Client({ connectionString: connection });

  try {
    await client.connect();

    // Update label to approved
    const result = await client.query(
      'UPDATE labels SET is_approved = TRUE WHERE id = $1 RETURNING *',
      [label_id]
    );

    if (result.rows.length === 0) {
      await client.end();
      return res.status(404).json({ error: 'Label not found' });
    }

    await client.end();
    res.json({ 
      success: true, 
      label: result.rows[0],
      message: 'Label approved. Future emails will sync to IMAP.' 
    });
  } catch (error: any) {
    console.error('Error approving label:', error);
    await client.end();
    res.status(500).json({ error: 'Failed to approve label' });
  }
});

/**
 * POST /api/labels/reject
 * Reject a label (delete it)
 */
router.post('/reject', async (req, res) => {
  const { label_id } = req.body;

  if (!label_id) {
    return res.status(400).json({ error: 'label_id is required' });
  }

  const client = new Client({ connectionString: connection });

  try {
    await client.connect();

    // Delete label and its associations
    await client.query('DELETE FROM email_labels WHERE label_id = $1', [label_id]);
    await client.query('DELETE FROM labels WHERE id = $1', [label_id]);

    await client.end();
    res.json({ success: true, message: 'Label rejected and removed' });
  } catch (error: any) {
    console.error('Error rejecting label:', error);
    await client.end();
    res.status(500).json({ error: 'Failed to reject label' });
  }
});

export default router;
