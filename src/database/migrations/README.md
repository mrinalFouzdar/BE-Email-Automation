# Database Migrations

## For New Developers - Quick Setup

### Prerequisites
- PostgreSQL 14+ installed
- pgvector extension available

### Setup Steps

1. **Create Database**
   ```bash
   createdb email_rag
   ```

2. **Run Initial Setup**
   ```bash
   psql -U postgres -d email_rag -f src/database/migrations/00_initial_setup.sql
   ```

   Or use the Node.js script:
   ```bash
   node run-migrations.js
   ```

3. **Verify Setup**
   ```bash
   node verify-migrations.js
   ```

---

## What Gets Created

### Tables:
1. **users** - User accounts
2. **email_accounts** - Email account connections (Gmail, IMAP)
3. **emails** - All email messages
4. **email_meta** - AI classifications & embeddings (768D vectors)
5. **labels** - User-defined categories
6. **email_labels** - Email-to-label assignments
7. **label_embeddings** - Label centroids for similarity
8. **pending_label_suggestions** - AI suggestions awaiting approval
9. **reminders** - Email-based reminders
10. **oauth_tokens** - OAuth credentials (legacy Gmail)
11. **classifications** - AI processing logs

### Key Features:
- ✅ **Vector embeddings** (768 dimensions) for semantic search
- ✅ **Embedding model tracking** (Gemini/Ollama)
- ✅ **AI classifications** (urgent, client, hierarchy, meeting, escalation)
- ✅ **Label suggestions** with confidence scores
- ✅ **Multi-account support** (Gmail & IMAP)

---

## Environment Variables

Create `.env` file:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/email_rag

# AI Configuration
GEMINI_API_KEY=your_gemini_api_key
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Server
PORT=4000

# Optional: OpenAI (not used by default)
# OPENAI_API_KEY=your_openai_key
```

---

## Embedding Models

The system uses **768-dimensional embeddings** from:
- **Primary**: Google Gemini (text-embedding-004)
- **Fallback**: Ollama (nomic-embed-text)

⚠️ **Important**: Only compare embeddings from the same model! The `embedding_model` column tracks which model created each embedding.

---

## Troubleshooting

### Issue: Vector extension not found
```bash
# Install pgvector
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install

# Enable in database
psql -d email_rag -c "CREATE EXTENSION vector;"
```

### Issue: Permission denied
```bash
# Grant permissions
psql -d email_rag -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;"
```

### Issue: Migration already applied
```sql
-- Check existing tables
\dt

-- Drop and recreate (⚠️ WARNING: Deletes all data!)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
-- Then run 00_initial_setup.sql again
```

---

## Post-Setup

After running migrations:

1. **Create Admin User**
   ```sql
   INSERT INTO users (email, password_hash, name, role)
   VALUES ('admin@example.com', 'hashed_password', 'Admin', 'admin');
   ```

2. **Add Email Account**
   ```sql
   INSERT INTO email_accounts (user_id, email, account_type, imap_host, imap_port, imap_username, imap_encrypted_password)
   VALUES (1, 'your@email.com', 'imap', 'imap.gmail.com', 993, 'your@email.com', 'encrypted_pass');
   ```

3. **Start Application**
   ```bash
   npm run dev
   ```

---

## Migration Files

- `00_initial_setup.sql` - Complete database schema (run this for new setups)

**Note**: All incremental migrations have been consolidated into the initial setup for simplicity.

---

## Need Help?

- Check database connection: `psql -U postgres -d email_rag -c "SELECT version();"`
- Verify tables: `psql -U postgres -d email_rag -c "\dt"`
- Check pgvector: `psql -U postgres -d email_rag -c "SELECT * FROM pg_extension WHERE extname = 'vector';"`
