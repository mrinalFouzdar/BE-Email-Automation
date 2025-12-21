import { client, ensureConnected } from '../config/db.js';
import { logger } from '../utils/logger.util.js';

/**
 * Cleanup script that deletes all data from database except admin users
 *
 * This script will:
 * - Delete all emails and email metadata
 * - Delete all email labels and label assignments
 * - Delete all email accounts
 * - Delete all pending label suggestions
 * - Delete all non-system labels
 * - Keep admin users and system labels
 */

async function cleanupDatabase() {
  try {
    console.log('🧹 Starting database cleanup...\n');

    // Wait a moment for auto-connect to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Start transaction
    await client.query('BEGIN');

    // 1. Delete all email-related data
    console.log('📧 Deleting email data...');

    const emailLabelsResult = await client.query('DELETE FROM email_labels');
    console.log(`   ✓ Deleted ${emailLabelsResult.rowCount} email label assignments`);

    const emailMetaResult = await client.query('DELETE FROM email_meta');
    console.log(`   ✓ Deleted ${emailMetaResult.rowCount} email metadata records`);

    const emailsResult = await client.query('DELETE FROM emails');
    console.log(`   ✓ Deleted ${emailsResult.rowCount} emails`);

    // 2. Delete pending label suggestions
    console.log('\n📋 Deleting pending label suggestions...');
    const suggestionsResult = await client.query('DELETE FROM pending_label_suggestions');
    console.log(`   ✓ Deleted ${suggestionsResult.rowCount} pending suggestions`);

    // 3. Delete label embeddings (for learning)
    console.log('\n🧠 Deleting label embeddings...');
    const labelEmbeddingsResult = await client.query('DELETE FROM label_embeddings');
    console.log(`   ✓ Deleted ${labelEmbeddingsResult.rowCount} label embeddings`);

    // 4. Delete user-label associations
    console.log('\n👤 Deleting user-label associations...');
    const userLabelsResult = await client.query('DELETE FROM user_labels');
    console.log(`   ✓ Deleted ${userLabelsResult.rowCount} user-label associations`);

    // 5. Delete custom labels (keep system labels)
    console.log('\n🏷️  Deleting custom labels (keeping system labels)...');
    const customLabelsResult = await client.query(
      'DELETE FROM labels WHERE is_system = false'
    );
    console.log(`   ✓ Deleted ${customLabelsResult.rowCount} custom labels`);

    // 6. Delete email accounts
    console.log('\n📬 Deleting email accounts...');
    const accountsResult = await client.query('DELETE FROM email_accounts');
    console.log(`   ✓ Deleted ${accountsResult.rowCount} email accounts`);
    // 6. Delete email accounts
    console.log('\n📬 Deleting email accounts...');
    const userAccount = await client.query('DELETE FROM users wHERE role != $1', ['admin']);
    console.log(`   ✓ Deleted ${userAccount.rowCount} user accounts`);

    // 7. Delete token usage stats (if table exists)
    try {
      console.log('\n📊 Deleting token usage stats...');
      const tokenStatsResult = await client.query('DELETE FROM token_usage_stats');
      console.log(`   ✓ Deleted ${tokenStatsResult.rowCount} token usage records`);
    } catch (error: any) {
      console.log(`   ⊙ Token usage stats table not found (skipping)`);
    }

    // 8. Keep admin users - just report count
    console.log('\n👨‍💼 Preserving admin users...');
    const adminUsersResult = await client.query(
      'SELECT COUNT(*) as count FROM users WHERE role = $1',
      ['admin']
    );
    console.log(`   ✓ Keeping ${adminUsersResult.rows[0].count} admin user(s)`);

    // 9. Keep system labels - just report count
    console.log('\n🔧 Preserving system labels...');
    const systemLabelsResult = await client.query(
      'SELECT COUNT(*) as count FROM labels WHERE is_system = true'
    );
    console.log(`   ✓ Keeping ${systemLabelsResult.rows[0].count} system label(s)`);

    // Commit transaction
    await client.query('COMMIT');

    console.log('\n✅ Database cleanup completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   • Emails deleted: ${emailsResult.rowCount}`);
    console.log(`   • Email accounts deleted: ${accountsResult.rowCount}`);
    console.log(`   • Custom labels deleted: ${customLabelsResult.rowCount}`);
    console.log(`   • Admin users preserved: ${adminUsersResult.rows[0].count}`);
    console.log(`   • System labels preserved: ${systemLabelsResult.rows[0].count}`);

  } catch (error: any) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('\n❌ Error during cleanup:', error.message);
    logger.error('Database cleanup failed:', error);
    throw error;
  } finally {
    // Close database connection
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run cleanup
cleanupDatabase()
  .then(() => {
    console.log('\n✨ Cleanup script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Cleanup script failed:', error);
    process.exit(1);
  });
