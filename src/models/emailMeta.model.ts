import { BaseModel } from './base.model';
import { EmailMeta } from '../types';

export class EmailMetaModel extends BaseModel<EmailMeta> {
  protected tableName = 'email_meta';
  protected primaryKey = 'id';

  /**
   * Find metadata by email ID
   */
  async findByEmailId(emailId: number): Promise<EmailMeta | null> {
    return this.findOne({ email_id: emailId } as any);
  }

  /**
   * Create or update email metadata
   */
  async upsert(emailId: number, data: Partial<EmailMeta>): Promise<EmailMeta> {
    const existing = await this.findByEmailId(emailId);

    if (existing) {
      return this.update(existing.id, data) as Promise<EmailMeta>;
    } else {
      return this.create({ ...data, email_id: emailId } as any);
    }
  }

  /**
   * Find urgent emails
   */
  async findUrgent(limit = 20): Promise<EmailMeta[]> {
    return this.findAll({
      where: { is_urgent: true } as any,
      orderBy: 'created_at DESC',
      limit,
    });
  }

  /**
   * Find meeting emails
   */
  async findMeetings(limit = 20): Promise<EmailMeta[]> {
    return this.findAll({
      where: { is_meeting: true } as any,
      orderBy: 'created_at DESC',
      limit,
    });
  }

  /**
   * Find escalation emails
   */
  async findEscalations(limit = 20): Promise<EmailMeta[]> {
    return this.findAll({
      where: { is_escalation: true } as any,
      orderBy: 'created_at DESC',
      limit,
    });
  }

  /**
   * Search similar emails by embedding
   */
  async searchSimilar(embedding: number[], limit = 5): Promise<any[]> {
    const query = `
      SELECT e.id, e.subject, e.body, m.embedding <-> $1::vector AS distance
      FROM email_meta m
      JOIN emails e ON m.email_id = e.id
      WHERE m.embedding IS NOT NULL
      ORDER BY m.embedding <-> $1::vector
      LIMIT $2
    `;

    const result = await this.query(query, [JSON.stringify(embedding), limit]);
    return result.rows;
  }
}

// Export singleton instance
export const emailMetaModel = new EmailMetaModel();
