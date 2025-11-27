import { db } from '../config/database.config.js';

async function checkAccountsTable() {
  try {
    await db.connect();
    console.log('🔗 Connected to database\n');

    // Check if user_id column exists
    const columnCheck = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'email_accounts' AND column_name = 'user_id';
    `);

    if (columnCheck.rows.length > 0) {
      console.log('✅ user_id column exists in email_accounts table\n');
      console.log('📋 Column Details:');
      console.log('================================================================================');
      const col = columnCheck.rows[0];
      console.log(`   Column: ${col.column_name}`);
      console.log(`   Type: ${col.data_type}`);
      console.log(`   Nullable: ${col.is_nullable}`);
    } else {
      console.log('❌ user_id column does NOT exist in email_accounts table\n');
    }

    // Show all columns in email_accounts
    const allColumns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'email_accounts'
      ORDER BY ordinal_position;
    `);

    console.log('\n📊 All columns in email_accounts:');
    console.log('================================================================================');
    allColumns.rows.forEach((col: any) => {
      console.log(`   ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkAccountsTable();
