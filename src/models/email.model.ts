import { BaseModel } from './base.model';
import { Email, EmailCreateInput, EmailFilters } from '../types';
import { db } from '../config/database.config';

export class EmailModel extends BaseModel<Email> {
  protected tableName = 'emails';
  protected primaryKey = 'id';

  /**
   * Find emails by account ID
   */
  async findByAccountId(accountId: number, limit = 50): Promise<Email[]> {
    return this.findAll({
      where: { account_id: accountId } as any,
      orderBy: 'received_at DESC',
      limit,
    });
  }

  /**
   * Find emails with filters
   */
  async findWithFilters(filters: EmailFilters, limit = 50, offset = 0): Promise<Email[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (filters.is_unread !== undefined) {
      conditions.push(`e.is_unread = $${paramCount++}`);
      params.push(filters.is_unread);
    }

    if (filters.sender) {
      conditions.push(`e.sender_email ILIKE $${paramCount++}`);
      params.push(`%${filters.sender}%`);
    }

    if (filters.search) {
      conditions.push(`(e.subject ILIKE $${paramCount} OR e.body ILIKE $${paramCount})`);
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    if (filters.from_date) {
      conditions.push(`e.received_at >= $${paramCount++}`);
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      conditions.push(`e.received_at <= $${paramCount++}`);
      params.push(filters.to_date);
    }

    if (filters.userId) {
      conditions.push(`ea.user_id = $${paramCount++}`);
      params.push(filters.userId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT e.* 
      FROM ${this.tableName} e
      JOIN email_accounts ea ON e.account_id = ea.id
      ${whereClause}
      ORDER BY e.received_at DESC
      LIMIT $${paramCount++}
      OFFSET $${paramCount}
    `;

    params.push(limit, offset);

    const result = await this.query(query, params);
    return result.rows;
  }

  /**
   * Count emails with filters
   */
  async countWithFilters(filters: EmailFilters): Promise<number> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (filters.is_unread !== undefined) {
      conditions.push(`e.is_unread = $${paramCount++}`);
      params.push(filters.is_unread);
    }

    if (filters.sender) {
      conditions.push(`e.sender_email ILIKE $${paramCount++}`);
      params.push(`%${filters.sender}%`);
    }

    if (filters.search) {
      conditions.push(`(e.subject ILIKE $${paramCount} OR e.body ILIKE $${paramCount})`);
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    if (filters.from_date) {
      conditions.push(`e.received_at >= $${paramCount++}`);
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      conditions.push(`e.received_at <= $${paramCount++}`);
      params.push(filters.to_date);
    }

    if (filters.userId) {
      conditions.push(`ea.user_id = $${paramCount++}`);
      params.push(filters.userId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT COUNT(*) 
      FROM ${this.tableName} e
      JOIN email_accounts ea ON e.account_id = ea.id
      ${whereClause}
    `;

    const result = await this.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Find email by Gmail ID
   */
  async findByGmailId(gmailId: string): Promise<Email | null> {
    return this.findOne({ gmail_id: gmailId } as any);
  }

  /**
   * Mark email as read/unread
   */
  async markAsRead(id: number, isRead = true): Promise<Email | null> {
    return this.update(id, { is_unread: !isRead } as any);
  }

  /**
   * Get unread count
   */
  async getUnreadCount(accountId?: number): Promise<number> {
    const where: any = { is_unread: true };
    if (accountId) {
      where.account_id = accountId;
    }
    return this.count(where);
  }

  /**
   * Create email with validation
   */
  async createEmail(data: EmailCreateInput): Promise<Email> {
    const emailData: any = {
      ...data,
      is_unread: true,
      received_at: new Date(),
      created_at: new Date(),
    };

    return this.create(emailData);
  }

  /**
   * Get email meta by email ID
   */
  async getMeta(emailId: number): Promise<any> {
    const query = `SELECT * FROM email_meta WHERE email_id = $1`;
    const result = await this.query(query, [emailId]);
    return result.rows[0] || {};
  }
}

// Export singleton instance
export const emailModel = new EmailModel();
