import { BaseModel } from './base.model';
import { Label, EmailLabel, LabelCreateInput, LabelAssignmentInput } from '../types';

export class LabelModel extends BaseModel<Label> {
  protected tableName = 'labels';
  protected primaryKey = 'id';

  /**
   * Find labels by user ID
   */
  async findByUserId(userId: number): Promise<Label[]> {
    const query = `
      SELECT l.* FROM labels l
      JOIN user_labels ul ON l.id = ul.label_id
      WHERE ul.user_id = $1 AND ul.is_active = true
      ORDER BY l.name ASC
    `;
    const result = await this.query(query, [userId]);
    return result.rows;
  }

  /**
   * Find system labels
   */
  async findSystemLabels(): Promise<Label[]> {
    return this.findAll({
      where: { is_system: true } as any,
      orderBy: 'name ASC',
    });
  }

  /**
   * Find label by name
   */
  async findByName(name: string): Promise<Label | null> {
    return this.findOne({ name } as any);
  }

  /**
   * Create label
   */
  async createLabel(data: LabelCreateInput): Promise<Label> {
    const labelData: any = {
      name: data.name,
      color: data.color || '#3B82F6',
      description: data.description,
      is_system: data.is_system || false,
      created_by_user_id: data.created_by_user_id,
      created_at: new Date(),
    };

    return this.create(labelData);
  }

  /**
   * Assign label to user
   */
  async assignToUser(userId: number, labelId: number): Promise<void> {
    const query = `
      INSERT INTO user_labels (user_id, label_id, is_active, created_at)
      VALUES ($1, $2, true, NOW())
      ON CONFLICT (user_id, label_id) DO UPDATE
      SET is_active = true
    `;
    await this.query(query, [userId, labelId]);
  }

  /**
   * Remove label from user
   */
  async removeFromUser(userId: number, labelId: number): Promise<void> {
    const query = `
      UPDATE user_labels
      SET is_active = false
      WHERE user_id = $1 AND label_id = $2
    `;
    await this.query(query, [userId, labelId]);
  }
}

export class EmailLabelModel extends BaseModel<EmailLabel> {
  protected tableName = 'email_labels';
  protected primaryKey = 'id';

  /**
   * Find labels for email
   */
  async findByEmailId(emailId: number): Promise<Label[]> {
    const query = `
      SELECT l.* FROM labels l
      JOIN email_labels el ON l.id = el.label_id
      WHERE el.email_id = $1
      ORDER BY l.name ASC
    `;
    const result = await this.query(query, [emailId]);
    return result.rows;
  }

  /**
   * Find emails by label
   */
  async findEmailsByLabelId(labelId: number, limit = 50): Promise<number[]> {
    const query = `
      SELECT email_id FROM email_labels
      WHERE label_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const result = await this.query(query, [labelId, limit]);
    return result.rows.map((row: any) => row.email_id);
  }

  /**
   * Assign label to email
   */
  async assignLabel(data: LabelAssignmentInput): Promise<EmailLabel> {
    const query = `
      INSERT INTO email_labels (email_id, label_id, assigned_by, confidence_score, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (email_id, label_id) DO UPDATE
      SET assigned_by = $3, confidence_score = $4
      RETURNING *
    `;

    const result = await this.query(query, [
      data.email_id,
      data.label_id,
      data.assigned_by,
      data.confidence_score || null,
    ]);

    return result.rows[0];
  }

  /**
   * Remove label from email
   */
  async removeLabel(emailId: number, labelId: number): Promise<boolean> {
    const query = `
      DELETE FROM email_labels
      WHERE email_id = $1 AND label_id = $2
    `;
    const result = await this.query(query, [emailId, labelId]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Remove all labels from email
   */
  async removeAllLabels(emailId: number): Promise<void> {
    const query = `DELETE FROM email_labels WHERE email_id = $1`;
    await this.query(query, [emailId]);
  }
}

// Export singleton instances
export const labelModel = new LabelModel();
export const emailLabelModel = new EmailLabelModel();
