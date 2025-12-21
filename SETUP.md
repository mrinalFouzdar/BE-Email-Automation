# Email RAG System - Quick Setup Guide

## 🚀 For New Developers

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ with pgvector extension
- (Optional) Ollama for local LLM

---

## 📦 Installation Steps

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Setup Environment
Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

Edit `.env`:
```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/email_rag

# AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Ollama (local LLM fallback)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Server
PORT=4000
```

### 3. Create Database
```bash
createdb email_rag
```

### 4. Run Migrations
```bash
node run-migrations.js
```

This will:
- Create all tables
- Setup pgvector extension
- Configure indexes
- Prepare for 768D embeddings (Gemini/Ollama)

### 5. Verify Setup
```bash
node verify-migrations.js
```

Should show:
```
✅ embedding column: vector(768)
✅ embedding_model column: VARCHAR(50)
```

### 6. Start Application
```bash
npm run dev
```

---

## 🔑 Get API Keys

### Google Gemini (Free)
1. Go to https://makersuite.google.com/app/apikey
2. Create API key
3. Add to `.env` as `GEMINI_API_KEY`

Limits: 15 requests/minute, 1500 requests/day (free tier)

### Ollama (Local - No API Key)
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull models
ollama pull llama3.2:3b
ollama pull nomic-embed-text
```

---

## 📊 Database Structure

The system uses:
- **Users** - User accounts
- **Email Accounts** - Gmail/IMAP connections
- **Emails** - All messages
- **Email Meta** - AI classifications + embeddings
- **Labels** - User categories
- **Email Labels** - Label assignments

---

## 🧠 AI Models

### Classification (Text → Labels)
- **Primary**: Gemini (gemini-1.5-flash)
- **Fallback**: Ollama (llama3.2:3b)
- **Last Resort**: Regex-based

### Embeddings (Text → Vectors)
- **Primary**: Gemini (text-embedding-004) → 768D
- **Fallback**: Ollama (nomic-embed-text) → 768D

⚠️ **Important**: Embeddings from different models are NOT compatible!

---

## 🧪 Testing

```bash
# Run tests
npm test

# Test Ollama connection
node src/scripts/test-ollama-embedding.js

# Test embedding flow
node src/scripts/test-embedding-flow.js
```

---

## 🐛 Troubleshooting

### Issue: `relation "emails" does not exist`
**Solution**: Run migrations
```bash
node run-migrations.js
```

### Issue: `extension "vector" does not exist`
**Solution**: Install pgvector
```bash
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
psql -d email_rag -c "CREATE EXTENSION vector;"
```

### Issue: `Cannot connect to Ollama`
**Solution**: Start Ollama
```bash
ollama serve
```

### Issue: Gemini API rate limit
**Solution**: System automatically falls back to Ollama

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/          # Database & app config
│   ├── modules/         # Feature modules
│   │   ├── extension/   # LangChain AI agents
│   │   └── rag/         # RAG & similarity
│   ├── services/        # Business logic
│   │   ├── email-processing.service.ts
│   │   ├── embedding.service.ts
│   │   ├── classifier.service.ts
│   │   └── imap-email.service.ts
│   ├── jobs/            # Background jobs
│   └── database/
│       └── migrations/  # Database schema
├── run-migrations.js    # Setup script
├── verify-migrations.js # Verification script
└── .env                 # Configuration
```

---

## 🚀 Quick Commands

```bash
# Development
npm run dev              # Start with hot reload
npm run build            # Build for production
npm start                # Run production build

# Database
node run-migrations.js   # Setup database
node verify-migrations.js # Verify setup

# Testing
npm test                 # Run tests
npm run test:watch       # Watch mode
```

---

## 📚 Learn More

- **Migrations**: See `src/database/migrations/README.md`
- **Embeddings**: See `EMBEDDING_MODEL_GUIDE.md`
- **AI Strategy**: See `EMBEDDING_STRATEGY.md`

---

## ✅ You're Ready!

After setup, the system will:
- ✅ Automatically sync IMAP emails
- ✅ Classify with AI (Gemini → Ollama fallback)
- ✅ Generate embeddings for similarity search
- ✅ Suggest labels based on content
- ✅ Track which model created each embedding

Happy coding! 🎉
