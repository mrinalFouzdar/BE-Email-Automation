import { client, connect } from '../config/db';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runLabelMigration() {
  try {
    await connect();
    console.log('Connected to DB');

    const migrationPath = path.resolve(__dirname, '../../migrations/add_labels_table.sql');
    console.log(`Reading migration from: ${migrationPath}`);
    
    if (!fs.existsSync(migrationPath)) {
      console.error('Migration file not found!');
      return;
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('Executing SQL...');
    
    await client.query(sql);
    console.log('✅ Successfully applied label migration');
    
  } catch (error) {
    console.error('Error running migration:', error);
  } finally {
    await client.end();
  }
}

runLabelMigration();
