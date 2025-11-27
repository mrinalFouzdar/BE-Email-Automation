import { BaseModel } from './base.model';
import { EmailAccount, AccountCreateInput } from '../types';

export class AccountModel extends BaseModel<EmailAccount> {
  protected tableName = 'email_accounts';
  protected primaryKey = 'id';

  /**
   * Find accounts by user ID
   */
  async findByUserId(userId: number): Promise<EmailAccount[]> {
    return this.findAll({
      where: { user_id: userId } as any,
      orderBy: 'created_at DESC',
    });
  }

  /**
   * Find active accounts
   */
  async findActiveAccounts(userId?: number): Promise<EmailAccount[]> {
    const where: any = { is_active: true };
    if (userId) {
      where.user_id = userId;
    }
    return this.findAll({ where, orderBy: 'created_at DESC' });
  }

  /**
   * Find account by email
   */
  async findByEmail(email: string): Promise<EmailAccount | null> {
    return this.findOne({ email } as any);
  }

  /**
   * Update last sync time
   */
  async updateLastSync(id: number): Promise<EmailAccount | null> {
    return this.update(id, {
      last_sync_at: new Date(),
      updated_at: new Date(),
    } as any);
  }

  /**
   * Update OAuth tokens
   */
  async updateOAuthTokens(
    id: number,
    accessToken: string,
    refreshToken?: string,
    expiryDate?: Date
  ): Promise<EmailAccount | null> {
    const data: any = {
      access_token: accessToken,
      updated_at: new Date(),
    };

    if (refreshToken) {
      data.refresh_token = refreshToken;
    }
    if (expiryDate) {
      data.token_expiry = expiryDate;
    }

    return this.update(id, data);
  }

  /**
   * Activate/Deactivate account
   */
  async setActive(id: number, isActive: boolean): Promise<EmailAccount | null> {
    return this.update(id, {
      is_active: isActive,
      updated_at: new Date(),
    } as any);
  }

  /**
   * Create account
   */
  async createAccount(data: AccountCreateInput): Promise<EmailAccount> {
    const accountData: any = {
      ...data,
      is_active: true,
      created_at: new Date(),
    };

    return this.create(accountData);
  }
}

// Export singleton instance
export const accountModel = new AccountModel();
