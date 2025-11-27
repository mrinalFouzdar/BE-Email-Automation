import { BaseModel } from './base.model';
import { User, UserCreateInput } from '../types';
import bcrypt from 'bcrypt';

export class UserModel extends BaseModel<User> {
  protected tableName = 'users';
  protected primaryKey = 'id';

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email } as any);
  }

  /**
   * Create user with hashed password
   */
  async createUser(data: UserCreateInput): Promise<User> {
    const passwordHash = await bcrypt.hash(data.password, 10);

    const userData: any = {
      email: data.email,
      password_hash: passwordHash,
      name: data.name,
      role: data.role || 'user',
      is_active: true,
      created_at: new Date(),
    };

    return this.create(userData);
  }

  /**
   * Verify password
   */
  async verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.password_hash) {
      return false;
    }
    return bcrypt.compare(password, user.password_hash);
  }

  /**
   * Update password
   */
  async updatePassword(id: number, newPassword: string): Promise<User | null> {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    return this.update(id, {
      password_hash: passwordHash,
      updated_at: new Date(),
    } as any);
  }

  /**
   * Activate/Deactivate user
   */
  async setActive(id: number, isActive: boolean): Promise<User | null> {
    return this.update(id, {
      is_active: isActive,
      updated_at: new Date(),
    } as any);
  }
}

// Export singleton instance
export const userModel = new UserModel();
