import { db } from '../config/database.config.js';

async function checkPendingLabelTable() {
  try {
    await db.connect();
    console.log('🔗 Connected to database\n');

    // Check if table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'pending_label_suggestions'
      ) as table_exists;
    `);

    const tableExists = tableCheck.rows[0]?.table_exists;
    console.log(`Table pending_label_suggestions exists: ${tableExists ? '✅ YES' : '❌ NO'}\n`);

    if (tableExists) {
      // Show table structure
      const structure = await db.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'pending_label_suggestions'
        ORDER BY ordinal_position;
      `);

      console.log('📋 Table Structure:');
      console.log('================================================================================');
      structure.rows.forEach((col: any) => {
        console.log(`   ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
      });

      // Check row count
      const count = await db.query('SELECT COUNT(*) FROM pending_label_suggestions');
      console.log(`\n📊 Row count: ${count.rows[0].count}`);
    } else {
      console.log('⚠️  Table does not exist. Running migrations...\n');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkPendingLabelTable();
