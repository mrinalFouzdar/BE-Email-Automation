import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function checkSchema() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to DB');

    const tables = [
      'pending_label_suggestions',
      'labels',
      'email_meta',
      'emails',
      'email_accounts'
    ];

    console.log('--- DB SCHEMA CHECK ---');

    for (const table of tables) {
      const res = await client.query(
        `SELECT column_name, data_type 
         FROM information_schema.columns 
         WHERE table_name = $1 
         ORDER BY column_name`,
        [table]
      );

      console.log(`\nTABLE: ${table}`);
      if (res.rows.length === 0) {
        console.log('  (Table not found!)');
      } else {
        res.rows.forEach(row => {
          console.log(`  - ${row.column_name} (${row.data_type})`);
        });
      }
    }

    console.log('\n--- END CHECK ---');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkSchema();
