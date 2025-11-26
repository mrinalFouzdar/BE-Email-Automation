import { client } from '../../config/db.js';
import { User, CreateUserDto, UserWithoutPassword } from './user.model.js';

export class UserService {
  async findByEmail(email: string): Promise<User | null> {
    const result = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  async findById(id: number): Promise<User | null> {
    const result = await client.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async create(userData: CreateUserDto): Promise<User> {
    const result = await client.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING *',
      [userData.email, userData.password, userData.name]
    );
    return result.rows[0];
  }

  async update(id: number, userData: Partial<CreateUserDto>): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (userData.email) {
      fields.push(`email = $${paramCount++}`);
      values.push(userData.email);
    }
    if (userData.password) {
      fields.push(`password = $${paramCount++}`);
      values.push(userData.password);
    }
    if (userData.name) {
      fields.push(`name = $${paramCount++}`);
      values.push(userData.name);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await client.query(query, values);
    return result.rows[0] || null;
  }

  removePassword(user: User): UserWithoutPassword {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}

export const userService = new UserService();
