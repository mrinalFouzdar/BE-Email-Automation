# Database Migrations

## 🔄 Automatic Migrations

Migrations now run **automatically** every time the backend server starts.

## 📋 Migration Files (Run in Order)

1. **`init.sql`** - Initial schema
   - Creates: emails, email_meta, reminders, oauth_tokens tables
   - Creates: pgvector extension and indexes

2. **`add_email_fields.sql`** - Email enhancements
   - Adds: to_recipients, cc_recipients, is_unread, labels
   - Adds: MoM tracking fields (is_mom, has_mom_received, related_meeting_id)

3. **`add_accounts_table.sql`** - Multi-account support
   - Creates: email_accounts table
   - Adds: account_id to emails table

4. **`add_imap_support.sql`** - IMAP provider support
   - Adds: provider_type, imap_host, imap_port, imap_username, imap_password_encrypted

5. **`add_manual_oauth_support.sql`** - User OAuth credentials
   - Adds: oauth_client_id, oauth_client_secret_encrypted, oauth_refresh_token_encrypted
   - Adds: monitored_labels

## ✅ Idempotent Design

All migrations use:
- `CREATE TABLE IF NOT EXISTS`
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`

This means they're **safe to run multiple times** without errors.

## 🚀 How It Works

### On Server Start:
```
1. Connect to database
2. Run all migrations (in order)
3. Start Express API server
4. Start agent runner
```

### Startup Output:
```
✓ Connected to database

🔄 Running database migrations...
✓ Applied migration: init.sql
✓ Applied migration: add_email_fields.sql
✓ Applied migration: add_accounts_table.sql
✓ Applied migration: add_imap_support.sql
✓ Applied migration: add_manual_oauth_support.sql
✅ All migrations completed successfully

✓ Backend API listening on 4000
✓ Agent Runner connected to database
✓ Agent Runner scheduled to run every 5 minutes

====================================
🚀 Backend is ready!
====================================
📡 API: http://localhost:4000
📚 Docs: http://localhost:4000/api-docs
====================================
```

## 🛠️ Manual Migration (Optional)

You can still run migrations manually:
```bash
cd backend
npm run migrate
```

## 📝 Adding New Migrations

1. Create new migration file in `backend/migrations/`
   ```sql
   -- migrations/add_new_feature.sql
   ALTER TABLE emails ADD COLUMN IF NOT EXISTS new_field TEXT;
   ```

2. Add to migration list in `src/migrate.ts`:
   ```typescript
   const MIGRATIONS = [
     'init.sql',
     'add_email_fields.sql',
     'add_accounts_table.sql',
     'add_imap_support.sql',
     'add_manual_oauth_support.sql',
     'add_new_feature.sql'  // Add here
   ];
   ```

3. Restart server - migration runs automatically!

## ⚠️ Best Practices

1. **Always use IF NOT EXISTS**
   ```sql
   CREATE TABLE IF NOT EXISTS my_table (...);
   ALTER TABLE my_table ADD COLUMN IF NOT EXISTS my_column TEXT;
   CREATE INDEX IF NOT EXISTS idx_name ON my_table(column);
   ```

2. **Never use DROP without IF EXISTS**
   ```sql
   -- Bad
   DROP TABLE my_table;

   -- Good
   DROP TABLE IF EXISTS my_table;
   ```

3. **Test migrations locally first**
   ```bash
   npm run dev  # Migrations run automatically
   ```

4. **Keep migrations small and focused**
   - One migration per feature/change
   - Easy to debug if something goes wrong

## 🐛 Troubleshooting

### Migration fails on startup
```bash
# Check error message in console
# Fix the SQL in the migration file
# Restart server
npm run dev
```

### Need to reset database
```bash
# Stop backend
# Stop and remove database
docker compose -f docker-compose.dev.yml down -v

# Start database fresh
docker compose -f docker-compose.dev.yml up -d

# Wait 10 seconds, then start backend
# All migrations will run automatically
npm run dev
```

### Skip migrations on startup
```bash
# Not recommended, but possible
# Comment out this line in src/index.ts:
# await runMigrations(false);
```

## 📊 Current Schema

Run this to see current database schema:
```bash
docker exec -it email_rag_db psql -U postgres -d email_rag -c "\dt"
docker exec -it email_rag_db psql -U postgres -d email_rag -c "\d emails"
```

## ✅ Benefits

1. **No manual steps** - Just start server
2. **Always up to date** - Never forget to run migrations
3. **Safe to restart** - Migrations are idempotent
4. **Fast startup** - Only applies new changes
5. **Easy development** - Just pull and run
