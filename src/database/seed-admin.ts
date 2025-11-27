import { database } from '../config/database.config.js';
import bcrypt from 'bcrypt';
import { logger } from '../utils/logger.util.js';

/**
 * Bootstrap script to create default admin user
 * Run this once to set up the admin account
 */

const DEFAULT_ADMIN = {
  email: process.env.ADMIN_EMAIL || 'admin@emailrag.com',
  password: process.env.ADMIN_PASSWORD || 'admin123456',  // Change this!
  name: 'System Admin',
  role: 'admin'
};

export async function seedAdmin(standalone = true) {
  try {
    if (standalone) {
      await database.connect();
    }

    const client = database.getClient();

    logger.info('🌱 Seeding admin user...');

    // Check if admin already exists
    const existingAdmin = await client.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [DEFAULT_ADMIN.email]
    );

    if (existingAdmin.rows.length > 0) {
      const user = existingAdmin.rows[0];

      if (user.role === 'admin') {
        logger.info(`✓ Admin user already exists: ${user.email}`);
        return user;
      } else {
        // Update existing user to admin
        await client.query(
          'UPDATE users SET role = $1 WHERE id = $2',
          ['admin', user.id]
        );
        logger.info(`✓ Updated existing user to admin: ${user.email}`);
        return user;
      }
    }

    // Hash password
    const password_hash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);

    // Create admin user
    const result = await client.query(
      `INSERT INTO users (email, password_hash, name, role, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, email, name, role, created_at`,
      [DEFAULT_ADMIN.email, password_hash, DEFAULT_ADMIN.name, DEFAULT_ADMIN.role]
    );

    const admin = result.rows[0];

    logger.info('✅ Admin user created successfully!');
    logger.info(`   Email: ${admin.email}`);
    logger.info(`   Password: ${DEFAULT_ADMIN.password}`);
    logger.info('   ⚠️  IMPORTANT: Change the password after first login!');

    return admin;

  } catch (err) {
    logger.error('❌ Error seeding admin:', err);
    throw err;
  } finally {
    if (standalone) {
      await database.disconnect();
    }
  }
}

// Run seed if this file is executed directly
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(process.argv[1]);

if (isMainModule) {
  seedAdmin(true)
    .then((admin) => {
      console.log('\n✅ Admin seeding completed successfully\n');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Admin seeding failed:', err);
      process.exit(1);
    });
}
