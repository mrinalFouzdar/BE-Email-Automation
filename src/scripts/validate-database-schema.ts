import { db } from '../config/database.config.js';

// Define all tables and their required columns based on the codebase
const EXPECTED_SCHEMA = {
  users: [
    'id', 'email', 'password_hash', 'name', 'role', 'is_active',
    'created_at', 'updated_at'
  ],
  email_accounts: [
    'id', 'user_id', 'email', 'account_name', 'provider_type',
    'imap_host', 'imap_port', 'imap_username', 'imap_password_encrypted',
    'oauth_token_id', 'oauth_client_id', 'oauth_client_secret_encrypted',
    'oauth_refresh_token_encrypted', 'auto_fetch', 'fetch_interval',
    'enable_ai_labeling', 'custom_labels', 'monitored_labels',
    'status', 'is_active', 'last_sync', 'created_at', 'updated_at'
  ],
  emails: [
    'id', 'account_id', 'message_id', 'thread_id', 'subject',
    'sender', 'sender_name', 'recipient', 'body', 'body_plain',
    'received_date', 'is_read', 'is_unread', 'is_starred',
    'is_important', 'has_attachments', 'gmail_labels',
    'created_at', 'updated_at'
  ],
  email_meta: [
    'id', 'email_id', 'vector_embedding', 'created_at', 'updated_at'
  ],
  labels: [
    'id', 'user_id', 'name', 'color', 'description', 'is_system',
    'created_at', 'updated_at'
  ],
  email_labels: [
    'id', 'email_id', 'label_id', 'assigned_at', 'assigned_by'
  ],
  pending_label_suggestions: [
    'id', 'email_id', 'user_id', 'suggested_label_name',
    'suggested_by', 'confidence_score', 'reasoning', 'status',
    'approved_by', 'approved_at', 'created_at'
  ],
  reminders: [
    'id', 'email_id', 'user_id', 'reminder_date', 'message',
    'is_completed', 'created_at', 'updated_at'
  ],
  oauth_tokens: [
    'id', 'user_id', 'email', 'access_token', 'refresh_token',
    'token_type', 'expiry_date', 'scope', 'created_at', 'updated_at'
  ],
  classifications: [
    'id', 'email_id', 'is_escalation', 'is_mom', 'is_urgent',
    'confidence_score', 'classified_at', 'created_at', 'updated_at'
  ]
};

interface ValidationResult {
  missingTables: string[];
  missingColumns: { [table: string]: string[] };
  extraTables: string[];
  errors: string[];
}

async function validateDatabaseSchema(): Promise<ValidationResult> {
  const result: ValidationResult = {
    missingTables: [],
    missingColumns: {},
    extraTables: [],
    errors: []
  };

  try {
    await db.connect();
    console.log('🔗 Connected to database\n');
    console.log('🔍 Validating database schema...\n');

    // Get all tables in the database
    const tablesQuery = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const existingTables = tablesQuery.rows.map((row: any) => row.table_name);
    const expectedTables = Object.keys(EXPECTED_SCHEMA);

    console.log('📋 Expected Tables:', expectedTables.length);
    console.log('📋 Existing Tables:', existingTables.length);
    console.log('================================================================================\n');

    // Check for missing tables
    for (const expectedTable of expectedTables) {
      if (!existingTables.includes(expectedTable)) {
        result.missingTables.push(expectedTable);
        console.log(`❌ MISSING TABLE: ${expectedTable}`);
      } else {
        console.log(`✅ Table exists: ${expectedTable}`);

        // Check columns for this table
        const columnsQuery = await db.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position;
        `, [expectedTable]);

        const existingColumns = columnsQuery.rows.map((row: any) => row.column_name);
        const expectedColumns = EXPECTED_SCHEMA[expectedTable as keyof typeof EXPECTED_SCHEMA];
        const missingCols: string[] = [];

        for (const expectedCol of expectedColumns) {
          if (!existingColumns.includes(expectedCol)) {
            missingCols.push(expectedCol);
          }
        }

        if (missingCols.length > 0) {
          result.missingColumns[expectedTable] = missingCols;
          console.log(`   ⚠️  Missing columns: ${missingCols.join(', ')}`);
        } else {
          console.log(`   ✓ All required columns present (${existingColumns.length} columns)`);
        }
      }
    }

    // Check for extra tables (not in our schema)
    for (const existingTable of existingTables) {
      if (!expectedTables.includes(existingTable)) {
        result.extraTables.push(existingTable);
      }
    }

    console.log('\n================================================================================');
    console.log('\n📊 VALIDATION SUMMARY:\n');

    if (result.missingTables.length === 0 && Object.keys(result.missingColumns).length === 0) {
      console.log('✅ All required tables and columns are present!\n');
    } else {
      if (result.missingTables.length > 0) {
        console.log(`❌ Missing Tables (${result.missingTables.length}):`);
        result.missingTables.forEach(table => console.log(`   - ${table}`));
        console.log('');
      }

      if (Object.keys(result.missingColumns).length > 0) {
        console.log(`❌ Missing Columns:`);
        for (const [table, columns] of Object.entries(result.missingColumns)) {
          console.log(`   ${table}:`);
          columns.forEach(col => console.log(`      - ${col}`));
        }
        console.log('');
      }
    }

    if (result.extraTables.length > 0) {
      console.log(`ℹ️  Extra Tables (not in expected schema): ${result.extraTables.join(', ')}\n`);
    }

  } catch (error: any) {
    console.error('❌ Validation Error:', error.message);
    result.errors.push(error.message);
  } finally {
    process.exit(0);
  }

  return result;
}

validateDatabaseSchema();
