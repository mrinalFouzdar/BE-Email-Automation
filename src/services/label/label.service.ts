import { client } from "../../config/db.js";

export interface Label {
  id: number;
  name: string;
  color: string;
  description?: string;
  is_system: boolean;
  created_by_user_id?: number;
  created_at: Date;
}

export interface LabelCreateDTO {
  name: string;
  color?: string;
  description?: string;
  userId?: number;
  isSystem?: boolean;
}

export class LabelService {
  /**
   * Initialize default system labels if they don't exist
   */
  async initializeSystemLabels(dbClient?: any): Promise<void> {
    const db = dbClient || client;
    const systemLabels = [
      { name: 'Escalation', color: '#EF4444', description: 'Urgent issues needing attention' },
      { name: 'Urgent', color: '#F59E0B', description: 'High priority emails' },
      { name: 'MOM', color: '#10B981', description: 'Minutes of Meeting' }
    ];

    for (const label of systemLabels) {
      // Check if label exists first
      const exists = await db.query(
        'SELECT id FROM labels WHERE name = $1 AND is_system = true',
        [label.name]
      );

      if (exists.rows.length === 0) {
        // Label doesn't exist, create it
        await db.query(
          `INSERT INTO labels (name, color, description, is_system)
           VALUES ($1, $2, $3, true)`,
          [label.name, label.color, label.description]
        );
        console.log(`    ✓ Created system label: ${label.name}`);
      } else {
        console.log(`    ⊙ System label already exists: ${label.name}`);
      }
    }
  }

  /**
   * Create a new label
   */
  async createLabel(data: LabelCreateDTO): Promise<Label> {
    const result = await client.query(
      `INSERT INTO labels (name, color, description, is_system, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.name,
        data.color || '#3B82F6',
        data.description,
        data.isSystem || false,
        data.userId
      ]
    );
    return result.rows[0];
  }

  /**
   * Get all labels available for a user (system labels + user's labels)
   */
  async getUserLabels(userId: number): Promise<Label[]> {
    const result = await client.query(
      `SELECT l.* 
       FROM labels l
       LEFT JOIN user_labels ul ON l.id = ul.label_id AND ul.user_id = $1
       WHERE l.is_system = true 
          OR l.created_by_user_id = $1
          OR ul.user_id = $1
       ORDER BY l.is_system DESC, l.name ASC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Assign a label to a user (for shared labels)
   */
  async assignLabelToUser(labelId: number, userId: number): Promise<void> {
    await client.query(
      `INSERT INTO user_labels (user_id, label_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, label_id) DO NOTHING`,
      [userId, labelId]
    );
  }

  /**
   * Get labels assigned to an email
   */
  async getEmailLabels(emailId: number, dbClient?: any): Promise<Label[]> {
    const db = dbClient || client;
    const result = await db.query(
      `SELECT l.*, el.assigned_by, el.confidence_score
       FROM labels l
       JOIN email_labels el ON l.id = el.label_id
       WHERE el.email_id = $1`,
      [emailId]
    );
    return result.rows;
  }

  /**
   * Assign a label to an email
   */
  async assignLabelToEmail(
    emailId: number,
    labelId: number,
    assignedBy: 'ai' | 'user' | 'admin' | 'system' = 'ai',
    confidence: number = 1.0,
    dbClient?: any
  ): Promise<void> {
    const db = dbClient || client;
    await db.query(
      `INSERT INTO email_labels (email_id, label_id, assigned_by, confidence_score)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email_id, label_id) DO UPDATE
       SET assigned_by = $3, confidence_score = $4`,
      [emailId, labelId, assignedBy, confidence]
    );
  }

  /**
   * Find a label by name (case insensitive)
   */
  async findLabelByName(name: string, userId?: number, dbClient?: any): Promise<Label | null> {
    const db = dbClient || client;
    let query = `SELECT * FROM labels WHERE LOWER(name) = LOWER($1)`;
    const params: any[] = [name];

    if (userId) {
      query += ` AND (is_system = true OR created_by_user_id = $2)`;
      params.push(userId);
    } else {
      query += ` AND is_system = true`;
    }

    const result = await db.query(query, params);
    return result.rows[0] || null;
  }
}
