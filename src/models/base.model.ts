import { db } from '../config/database.config';
import { FilterOptions } from '../types';
import { logger } from '../utils';

/**
 * Base Model with common CRUD operations
 * All models should extend this class
 */
export abstract class BaseModel<T> {
  protected abstract tableName: string;
  protected abstract primaryKey: string;

  /**
   * Find a record by ID
   */
  async findById(id: number | string): Promise<T | null> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = $1`;
      const result = await db.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error finding ${this.tableName} by ID`, error);
      throw error;
    }
  }

  /**
   * Find all records with optional filters
   */
  async findAll(options?: FilterOptions): Promise<T[]> {
    try {
      let query = `SELECT * FROM ${this.tableName}`;
      const params: any[] = [];
      let paramCount = 1;

      // Add WHERE clause
      if (options?.where && Object.keys(options.where).length > 0) {
        const conditions = Object.entries(options.where).map(([key, value]) => {
          params.push(value);
          return `${key} = $${paramCount++}`;
        });
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      // Add ORDER BY
      if (options?.orderBy) {
        query += ` ORDER BY ${options.orderBy}`;
      }

      // Add LIMIT
      if (options?.limit) {
        query += ` LIMIT $${paramCount++}`;
        params.push(options.limit);
      }

      // Add OFFSET
      if (options?.offset) {
        query += ` OFFSET $${paramCount}`;
        params.push(options.offset);
      }

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error(`Error finding all ${this.tableName}`, error);
      throw error;
    }
  }

  /**
   * Find one record matching criteria
   */
  async findOne(where: Partial<T>): Promise<T | null> {
    try {
      const results = await this.findAll({ where: where as any, limit: 1 });
      return results[0] || null;
    } catch (error) {
      logger.error(`Error finding one ${this.tableName}`, error);
      throw error;
    }
  }

  /**
   * Create a new record
   */
  async create(data: Partial<T>): Promise<T> {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const columns = keys.join(', ');

      const query = `
        INSERT INTO ${this.tableName} (${columns})
        VALUES (${placeholders})
        RETURNING *
      `;

      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error(`Error creating ${this.tableName}`, error);
      throw error;
    }
  }

  /**
   * Update a record by ID
   */
  async update(id: number | string, data: Partial<T>): Promise<T | null> {
    try {
      const keys = Object.keys(data);
      const values = Object.values(data);
      const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');

      const query = `
        UPDATE ${this.tableName}
        SET ${setClause}
        WHERE ${this.primaryKey} = $${keys.length + 1}
        RETURNING *
      `;

      const result = await db.query(query, [...values, id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error updating ${this.tableName}`, error);
      throw error;
    }
  }

  /**
   * Delete a record by ID
   */
  async delete(id: number | string): Promise<boolean> {
    try {
      const query = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = $1`;
      const result = await db.query(query, [id]);
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      logger.error(`Error deleting ${this.tableName}`, error);
      throw error;
    }
  }

  /**
   * Count records with optional filter
   */
  async count(where?: Partial<T>): Promise<number> {
    try {
      let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
      const params: any[] = [];

      if (where && Object.keys(where).length > 0) {
        const conditions = Object.entries(where).map(([key, value], i) => {
          params.push(value);
          return `${key} = $${i + 1}`;
        });
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      const result = await db.query(query, params);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      logger.error(`Error counting ${this.tableName}`, error);
      throw error;
    }
  }

  /**
   * Execute raw query
   */
  protected async query(sql: string, params?: any[]): Promise<any> {
    try {
      return await db.query(sql, params);
    } catch (error) {
      logger.error('Error executing query', error);
      throw error;
    }
  }
}
