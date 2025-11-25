"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const db_1 = require("./config/db");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// List of all migrations in order
const MIGRATIONS = [
    'init.sql',
    'add_email_fields.sql',
    'add_accounts_table.sql',
    'add_imap_support.sql',
    'add_manual_oauth_support.sql'
];
async function runMigrations(standalone = true) {
    try {
        if (standalone) {
            await (0, db_1.connect)();
        }
        console.log('🔄 Running database migrations...');
        for (const migration of MIGRATIONS) {
            const migrationPath = path_1.default.resolve(__dirname, '../migrations', migration);
            if (!fs_1.default.existsSync(migrationPath)) {
                console.log(`⚠️  Migration file not found: ${migration} (skipping)`);
                continue;
            }
            const sql = fs_1.default.readFileSync(migrationPath, 'utf8');
            await db_1.client.query(sql);
            console.log(`✓ Applied migration: ${migration}`);
        }
        console.log('✅ All migrations completed successfully');
    }
    catch (err) {
        console.error('❌ Migration error:', err);
        throw err;
    }
    finally {
        if (standalone) {
            await db_1.client.end();
        }
    }
}
// Run migrations if this file is executed directly
if (require.main === module) {
    runMigrations(true).then(() => {
        process.exit(0);
    }).catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
}
