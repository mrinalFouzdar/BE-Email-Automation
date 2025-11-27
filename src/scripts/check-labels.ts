import { client, connect } from '../config/db';

async function checkLabels() {
  try {
    await connect();
    const result = await client.query("SELECT to_regclass('public.labels')");
    if (result.rows[0].to_regclass) {
      console.log('✅ Labels table exists');
      
      // Check if system labels exist
      const labels = await client.query("SELECT * FROM labels WHERE is_system = true");
      console.log(`Found ${labels.rows.length} system labels`);
    } else {
      console.error('❌ Labels table does NOT exist');
    }
  } catch (error) {
    console.error('Error checking labels:', error);
  } finally {
    await client.end();
  }
}

checkLabels();
