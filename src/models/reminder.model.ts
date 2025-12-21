import { BaseModel } from './base.model';

export interface Reminder {
  id: number;
  email_id: number;
  reminder_text: string;
  reason?: string;
  priority: number;
  resolved: boolean;
  created_at: Date;
}

export interface ReminderCreateInput {
  email_id: number;
  reminder_text: string;
  reason?: string;
  priority?: number;
}

export class ReminderModel extends BaseModel<Reminder> {
  protected tableName = 'reminders';
  protected primaryKey = 'id';

  /**
   * Find reminders by email ID
   */
  async findByEmailId(emailId: number): Promise<Reminder[]> {
    return this.findAll({
      where: { email_id: emailId } as any,
      orderBy: 'priority DESC, created_at DESC',
    });
  }

  /**
   * Find reminders by user ID
   */
  async findByUserId(userId: number, limit = 50, resolved = false): Promise<Reminder[]> {
    const query = `
      SELECT r.*
      FROM reminders r
      JOIN emails e ON r.email_id = e.id
      JOIN email_accounts a ON e.account_id = a.id
      WHERE a.user_id = $1 AND r.resolved = $2
      ORDER BY r.priority DESC, r.created_at DESC
      LIMIT $3
    `;
    const result = await this.query(query, [userId, resolved, limit]);
    return result.rows;
  }

  /**
   * Find unresolved reminders
   */
  async findUnresolved(limit = 50): Promise<Reminder[]> {
    return this.findAll({
      where: { resolved: false } as any,
      orderBy: 'priority DESC, created_at DESC',
      limit,
    });
  }

  /**
   * Find high priority reminders
   */
  async findHighPriority(minPriority = 3): Promise<Reminder[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE resolved = false AND priority >= $1
      ORDER BY priority DESC, created_at DESC
    `;
    const result = await this.query(query, [minPriority]);
    return result.rows;
  }

  /**
   * Create reminder
   */
  async createReminder(data: ReminderCreateInput): Promise<Reminder> {
    const reminderData: any = {
      email_id: data.email_id,
      reminder_text: data.reminder_text,
      reason: data.reason,
      priority: data.priority || 1,
      resolved: false,
      created_at: new Date(),
    };

    return this.create(reminderData);
  }

  /**
   * Mark reminder as resolved
   */
  async resolve(id: number): Promise<Reminder | null> {
    return this.update(id, { resolved: true } as any);
  }

  /**
   * Mark reminder as unresolved
   */
  async unresolve(id: number): Promise<Reminder | null> {
    return this.update(id, { resolved: false } as any);
  }

  /**
   * Update priority
   */
  async updatePriority(id: number, priority: number): Promise<Reminder | null> {
    return this.update(id, { priority } as any);
  }
}

// Export singleton instance
export const reminderModel = new ReminderModel();
