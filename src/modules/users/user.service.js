import { client } from '../../config/db.js';
export class UserService {
    async findByEmail(email) {
        const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0] || null;
    }
    async findById(id) {
        const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    async create(userData) {
        const result = await client.query('INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING *', [userData.email, userData.password, userData.name]);
        return result.rows[0];
    }
    async update(id, userData) {
        const fields = [];
        const values = [];
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
    removePassword(user) {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }
}
export const userService = new UserService();
