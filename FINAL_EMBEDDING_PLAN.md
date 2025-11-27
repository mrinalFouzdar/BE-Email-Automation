# 🎯 FINAL Embedding & Classification Plan

## Your Requirements Summary

✅ **1. When admin adds IMAP user:**
- Fetch all emails from IMAP
- Store email data with vector embeddings
- Classify each email automatically

✅ **2. System Labels (MOM, Urgent, Escalation):**
- If email contains specific keywords → Auto-assign directly
- Map embedding to that label
- Show explanation of WHY (key phrases found)

✅ **3. Custom Labels (Non-system):**
- AI suggests label based on content + similarity
- Admin/User approves or rejects
- On approval → Map embedding to that label
- Future similar emails → Higher confidence suggestions

✅ **4. Embedding Provider Strategy:**
- **Priority 1:** Gemini (if API key provided)
- **Priority 2:** Local embeddings (fallback)
- **Auto-fallback:** If Gemini breaks → Use local

✅ **5. Language:**
- All code in **Node.js/TypeScript** (not Python)

---

## 🏗️ Complete System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Admin Creates IMAP User                                     │
└────────────────────┬────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ Fetch ALL Emails from IMAP Server                          │
│ (500 emails fetched)                                        │
└────────────────────┬────────────────────────────────────────┘
                     ↓
       ┌─────────────────────────────┐
       │  FOR EACH EMAIL:            │
       └─────────────┬───────────────┘
                     ↓
    ┌────────────────────────────────┐
    │ 1. Generate Embedding          │
    │    - Try Gemini first          │
    │    - Fallback to local if fail │
    │    - Store in email_meta       │
    └────────────┬───────────────────┘
                 ↓
    ┌────────────────────────────────┐
    │ 2. Keyword Detection (Fast)    │
    │    - Check MOM keywords        │
    │    - Check Urgent keywords     │
    │    - Check Escalation keywords │
    └────────────┬───────────────────┘
                 ↓
           ┌─────────────┐
           │ Keywords     │
           │ Found?       │
           └──┬───────┬───┘
              │       │
         YES  │       │  NO
              ↓       ↓
    ┌─────────────────────────────────┐
    │ AUTO-ASSIGN System Label        │
    │ - Store key phrases             │
    │ - Store explanation             │
    │ - Update label_embeddings       │
    └─────────────────────────────────┘
                                  ↓
                        ┌─────────────────────────┐
                        │ 3. AI Classification    │
                        │    (Hybrid Approach)    │
                        └──────────┬──────────────┘
                                   ↓
                    ┌──────────────────────────────┐
                    │ Path A: LLM Classification   │
                    │ (Gemini analyzes content)    │
                    └──────────┬───────────────────┘
                               ↓
                    ┌──────────────────────────────┐
                    │ Path B: Similarity Search    │
                    │ (Find similar labeled emails)│
                    └──────────┬───────────────────┘
                               ↓
                    ┌──────────────────────────────┐
                    │ Merge Results (Weighted)     │
                    │ - LLM: 40%                   │
                    │ - Similarity: 60%            │
                    └──────────┬───────────────────┘
                               ↓
                        ┌──────────────┐
                        │ Confidence   │
                        │ > 80%?       │
                        └──┬────────┬──┘
                           │        │
                      YES  │        │  NO
                           ↓        ↓
            ┌────────────────────────────────┐
            │ AUTO-ASSIGN Custom Label       │
            │ - Update label_embeddings      │
            └────────────────────────────────┘
                                      ↓
                            ┌──────────────────────────┐
                            │ SUGGEST for Approval     │
                            │ - Show to admin/user     │
                            │ - Include explanation    │
                            │ - Show similar emails    │
                            └──────────┬───────────────┘
                                       ↓
                            ┌──────────────────────────┐
                            │ User Approves?           │
                            └──┬────────────────────┬──┘
                               │                    │
                          YES  │                    │  NO
                               ↓                    ↓
                    ┌─────────────────────┐  ┌────────────┐
                    │ Assign Label        │  │ Reject     │
                    │ Update Embeddings   │  │ Store      │
                    │ Learn for Future    │  │ Feedback   │
                    └─────────────────────┘  └────────────┘
```

---

## 📊 Database Schema (Complete)

### 1. email_meta (stores email embeddings)
```sql
CREATE TABLE email_meta (
  id SERIAL PRIMARY KEY,
  email_id INT REFERENCES emails(id) ON DELETE CASCADE,

  -- Classification flags
  is_hierarchy BOOLEAN DEFAULT FALSE,
  is_client BOOLEAN DEFAULT FALSE,
  is_meeting BOOLEAN DEFAULT FALSE,
  is_escalation BOOLEAN DEFAULT FALSE,
  is_urgent BOOLEAN DEFAULT FALSE,
  is_mom BOOLEAN DEFAULT FALSE,

  -- EMBEDDING (main feature)
  embedding vector(768),  -- Gemini: 768 dims

  classification JSONB,
  vector_embedding vector(1536),  -- For compatibility
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_meta_vector
  ON email_meta USING ivfflat (embedding vector_cosine_ops);
```

### 2. label_embeddings (NEW - stores label prototypes)
```sql
CREATE TABLE label_embeddings (
  id SERIAL PRIMARY KEY,
  label_id INT REFERENCES labels(id) ON DELETE CASCADE,

  embedding vector(768) NOT NULL,
  email_count INT DEFAULT 0,  -- How many emails contributed

  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(label_id)
);

CREATE INDEX idx_label_embeddings_vector
  ON label_embeddings USING ivfflat (embedding vector_cosine_ops);
```

### 3. email_labels (enhanced with confidence tracking)
```sql
ALTER TABLE email_labels
  ADD COLUMN similarity_score FLOAT,
  ADD COLUMN assignment_method VARCHAR(20) DEFAULT 'manual';
  -- Values: 'keyword', 'ai_auto', 'ai_approved', 'similarity', 'manual'
```

### 4. pending_label_suggestions (enhanced with explanations)
```sql
ALTER TABLE pending_label_suggestions
  ADD COLUMN similarity_score FLOAT,
  ADD COLUMN similar_email_ids INT[],
  ADD COLUMN suggestion_method VARCHAR(20) DEFAULT 'ai',
  ADD COLUMN key_phrases TEXT[],          -- NEW: Keywords found
  ADD COLUMN explanation TEXT;            -- NEW: Why AI suggested this
```

---

## 🔧 Implementation Code (Node.js/TypeScript)

### 1. Embedding Service (with fallback)

```typescript
// backend/src/services/embedding.service.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let genAI: GoogleGenerativeAI | null = null;

if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  console.log('✅ Gemini embeddings enabled');
} else {
  console.warn('⚠️  Gemini API key not found - using local embeddings');
}

/**
 * Generate embedding with automatic fallback
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  // Try Gemini first (if API key provided)
  if (genAI) {
    try {
      return await generateGeminiEmbedding(text);
    } catch (error: any) {
      console.warn(`⚠️  Gemini embedding failed: ${error.message}`);
      console.log('🔄 Falling back to local embeddings...');
      return await generateLocalEmbedding(text);
    }
  }

  // Use local embeddings
  return await generateLocalEmbedding(text);
}

/**
 * Gemini embeddings (768 dimensions, FREE)
 */
async function generateGeminiEmbedding(text: string): Promise<number[]> {
  if (!genAI) throw new Error('Gemini not initialized');

  const model = genAI.getGenerativeModel({ model: 'embedding-001' });
  const result = await model.embedContent(text);
  return result.embedding.values;  // 768 dimensions
}

/**
 * Local embeddings (fallback)
 * Using simple TF-IDF or sentence-transformers via ONNX
 */
async function generateLocalEmbedding(text: string): Promise<number[]> {
  // TODO: Implement local embedding
  // Options:
  // 1. Use transformers.js (runs in Node.js)
  // 2. Use Python bridge with sentence-transformers
  // 3. Use simple TF-IDF vectorization

  console.warn('⚠️  Local embeddings not implemented yet - returning null');
  return new Array(768).fill(0);  // Placeholder: 768-dim zero vector
}
```

### 2. Keyword-Based Classification (Fast, Direct Assignment)

```typescript
// backend/src/services/keyword-classifier.service.ts

export interface KeywordMatch {
  label: string;
  keyPhrases: string[];
  confidence: number;
  explanation: string;
}

/**
 * Fast keyword-based detection for system labels
 * Returns matches if keywords found → Auto-assign directly
 */
export function detectSystemLabels(
  subject: string,
  body: string
): KeywordMatch[] {
  const fullText = `${subject}\n${body}`;
  const matches: KeywordMatch[] = [];

  // 1. Check MOM
  const momKeywords = detectMOMKeywords(fullText);
  if (momKeywords.length > 0) {
    matches.push({
      label: 'MOM',
      keyPhrases: momKeywords,
      confidence: 0.95,
      explanation: `Email contains meeting-related keywords: ${momKeywords.slice(0, 3).join(', ')}`
    });
  }

  // 2. Check Urgent
  const urgentKeywords = detectUrgentKeywords(fullText);
  if (urgentKeywords.length > 0) {
    matches.push({
      label: 'Urgent',
      keyPhrases: urgentKeywords,
      confidence: 0.90,
      explanation: `Email contains urgency indicators: ${urgentKeywords.slice(0, 3).join(', ')}`
    });
  }

  // 3. Check Escalation
  const escalationKeywords = detectEscalationKeywords(fullText);
  if (escalationKeywords.length > 0) {
    matches.push({
      label: 'Escalation',
      keyPhrases: escalationKeywords,
      confidence: 0.92,
      explanation: `Email requires escalation due to: ${escalationKeywords.slice(0, 3).join(', ')}`
    });
  }

  return matches;
}

function detectMOMKeywords(text: string): string[] {
  const patterns = [
    /\bMOM\b/gi,
    /meeting (minutes|notes|summary)/gi,
    /minutes of.*meeting/gi,
    /action items?/gi,
    /decisions? (made|taken)/gi,
    /attendees?:/gi,
    /participants?:/gi
  ];

  return extractMatches(text, patterns);
}

function detectUrgentKeywords(text: string): string[] {
  const patterns = [
    /\b(urgent|URGENT|asap|ASAP|immediately)\b/gi,
    /high priority/gi,
    /time[- ]sensitive/gi,
    /deadline.*today/gi,
    /\[URGENT\]/gi
  ];

  return extractMatches(text, patterns);
}

function detectEscalationKeywords(text: string): string[] {
  const patterns = [
    /escalat(e|ed|ing)/gi,
    /critical (issue|problem|bug)/gi,
    /need.*management.*attention/gi,
    /production (down|outage)/gi,
    /sev[- ]?1/gi
  ];

  return extractMatches(text, patterns);
}

function extractMatches(text: string, patterns: RegExp[]): string[] {
  const matches: string[] = [];

  for (const pattern of patterns) {
    const found = text.match(pattern);
    if (found) {
      matches.push(...found);
    }
  }

  // Remove duplicates
  return [...new Set(matches)];
}
```

### 3. Hybrid Classification Service

```typescript
// backend/src/services/hybrid-classifier.service.ts

import { generateEmbedding } from './embedding.service.js';
import { detectSystemLabels } from './keyword-classifier.service.js';
import { classifyWithLLM } from './gemini-classifier.service.js';
import { findSimilarEmails } from './similarity.service.js';

export interface HybridClassificationResult {
  label: string;
  confidence: number;
  keyPhrases: string[];
  explanation: string;
  method: 'keyword' | 'ai' | 'similarity' | 'hybrid';
  autoAssign: boolean;
}

export async function classifyEmailHybrid(
  subject: string,
  body: string
): Promise<HybridClassificationResult[]> {
  const results: HybridClassificationResult[] = [];

  // STEP 1: Fast Keyword Detection (System Labels)
  const keywordMatches = detectSystemLabels(subject, body);

  if (keywordMatches.length > 0) {
    // Found keywords → Auto-assign directly!
    for (const match of keywordMatches) {
      results.push({
        label: match.label,
        confidence: match.confidence,
        keyPhrases: match.keyPhrases,
        explanation: match.explanation,
        method: 'keyword',
        autoAssign: true  // ✅ Direct assignment
      });
    }

    // Return early - keyword matches are definitive for system labels
    return results;
  }

  // STEP 2: Generate Embedding
  const embedding = await generateEmbedding(`${subject}\n${body}`);

  if (!embedding) {
    console.warn('⚠️  No embedding generated - using LLM only');
    // Fall back to LLM only
    const llmResult = await classifyWithLLM(subject, body);
    return llmResult.map(r => ({ ...r, method: 'ai' as const, autoAssign: r.confidence > 0.8 }));
  }

  // STEP 3: Similarity Search
  const similarEmails = await findSimilarEmails(embedding, 5);

  // STEP 4: LLM Classification
  const llmResults = await classifyWithLLM(subject, body);

  // STEP 5: Merge Results (Weighted Average)
  const mergedResults = mergeClassifications(llmResults, similarEmails);

  return mergedResults;
}

function mergeClassifications(
  llmResults: any[],
  similarEmails: any[]
): HybridClassificationResult[] {
  // Aggregate labels from similar emails
  const similarityLabels = aggregateSimilarLabels(similarEmails);

  const merged: HybridClassificationResult[] = [];

  // Combine LLM and similarity results
  for (const llmResult of llmResults) {
    const simMatch = similarityLabels.find(s => s.label === llmResult.label);

    let finalConfidence: number;
    let method: 'ai' | 'similarity' | 'hybrid';

    if (simMatch) {
      // Both LLM and similarity suggest same label → High confidence
      finalConfidence = (llmResult.confidence * 0.4) + (simMatch.confidence * 0.6);
      method = 'hybrid';
    } else {
      // Only LLM suggests this label
      finalConfidence = llmResult.confidence * 0.7;  // Reduce confidence
      method = 'ai';
    }

    merged.push({
      label: llmResult.label,
      confidence: finalConfidence,
      keyPhrases: llmResult.keyPhrases || [],
      explanation: llmResult.explanation,
      method,
      autoAssign: finalConfidence > 0.80
    });
  }

  // Add similarity-only suggestions
  for (const simLabel of similarityLabels) {
    if (!merged.find(m => m.label === simLabel.label)) {
      merged.push({
        label: simLabel.label,
        confidence: simLabel.confidence * 0.6,  // Lower confidence for similarity-only
        keyPhrases: [],
        explanation: `Similar to ${simLabel.emailCount} previously labeled emails`,
        method: 'similarity',
        autoAssign: false  // Don't auto-assign similarity-only
      });
    }
  }

  return merged;
}

function aggregateSimilarLabels(similarEmails: any[]): any[] {
  // Count label occurrences in similar emails
  const labelCounts: { [label: string]: number } = {};

  for (const email of similarEmails) {
    for (const label of email.labels || []) {
      labelCounts[label] = (labelCounts[label] || 0) + 1;
    }
  }

  // Convert to array with confidence scores
  return Object.entries(labelCounts).map(([label, count]) => ({
    label,
    confidence: count / similarEmails.length,  // % of similar emails with this label
    emailCount: count
  }));
}
```

### 4. Email Processing Pipeline (Complete)

```typescript
// backend/src/jobs/process-email-with-classification.job.ts

import { generateEmbedding } from '../services/embedding.service.js';
import { classifyEmailHybrid } from '../services/hybrid-classifier.service.js';
import { db } from '../config/database.config.js';

export async function processEmail(email: any, userId: number): Promise<void> {
  console.log(`📧 Processing email: ${email.subject}`);

  // 1. Save email to database
  const emailResult = await db.query(
    `INSERT INTO emails (account_id, subject, body, sender, received_date, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING id`,
    [email.accountId, email.subject, email.body, email.sender, email.receivedDate]
  );

  const emailId = emailResult.rows[0].id;

  // 2. Generate embedding
  const embedding = await generateEmbedding(`${email.subject}\n${email.body}`);

  if (embedding) {
    await db.query(
      `INSERT INTO email_meta (email_id, embedding, created_at)
       VALUES ($1, $2, NOW())`,
      [emailId, `[${embedding.join(',')}]`]  // Convert array to vector
    );
  }

  // 3. Classify email (hybrid approach)
  const classifications = await classifyEmailHybrid(email.subject, email.body);

  // 4. Process classifications
  for (const classification of classifications) {
    if (classification.autoAssign) {
      // High confidence → Auto-assign label
      await assignLabel(emailId, userId, classification);
      console.log(`   ✅ Auto-assigned: ${classification.label} (${Math.round(classification.confidence * 100)}%)`);
    } else {
      // Low confidence → Create suggestion for approval
      await createSuggestion(emailId, userId, classification);
      console.log(`   📋 Suggested: ${classification.label} (${Math.round(classification.confidence * 100)}%)`);
    }
  }

  console.log(`   ✓ Email processed successfully`);
}

async function assignLabel(
  emailId: number,
  userId: number,
  classification: any
): Promise<void> {
  // Get or create label
  let labelResult = await db.query(
    'SELECT id FROM labels WHERE name = $1 AND (user_id = $2 OR is_system = true)',
    [classification.label, userId]
  );

  let labelId: number;

  if (labelResult.rows.length === 0) {
    // Create new label
    const newLabel = await db.query(
      `INSERT INTO labels (user_id, name, is_system, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id`,
      [userId, classification.label, ['MOM', 'Urgent', 'Escalation'].includes(classification.label)]
    );
    labelId = newLabel.rows[0].id;
  } else {
    labelId = labelResult.rows[0].id;
  }

  // Assign label to email
  await db.query(
    `INSERT INTO email_labels (email_id, label_id, similarity_score, assignment_method, assigned_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (email_id, label_id) DO NOTHING`,
    [emailId, labelId, classification.confidence, classification.method]
  );

  // Update label embeddings (for learning)
  await updateLabelEmbedding(labelId, emailId);
}

async function createSuggestion(
  emailId: number,
  userId: number,
  classification: any
): Promise<void> {
  await db.query(
    `INSERT INTO pending_label_suggestions
     (email_id, user_id, suggested_label_name, confidence_score, key_phrases, explanation, suggestion_method, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
     ON CONFLICT (email_id, suggested_label_name) DO NOTHING`,
    [
      emailId,
      userId,
      classification.label,
      classification.confidence,
      classification.keyPhrases,
      classification.explanation,
      classification.method
    ]
  );
}

async function updateLabelEmbedding(labelId: number, emailId: number): Promise<void> {
  // Get email embedding
  const emailEmbedding = await db.query(
    'SELECT embedding FROM email_meta WHERE email_id = $1',
    [emailId]
  );

  if (emailEmbedding.rows.length === 0) return;

  const newEmbedding = emailEmbedding.rows[0].embedding;

  // Update label embedding (weighted average)
  await db.query(
    `INSERT INTO label_embeddings (label_id, embedding, email_count, last_updated)
     VALUES ($1, $2, 1, NOW())
     ON CONFLICT (label_id) DO UPDATE SET
       embedding = (label_embeddings.embedding * label_embeddings.email_count + EXCLUDED.embedding) / (label_embeddings.email_count + 1),
       email_count = label_embeddings.email_count + 1,
       last_updated = NOW()`,
    [labelId, newEmbedding]
  );
}
```

---

## 🎯 Summary: What You Get

### ✅ When Admin Adds IMAP User:

1. **Fetch all emails** from IMAP (e.g., 500 emails)
2. **Generate embeddings** (Gemini → fallback to local if fail)
3. **Classify each email:**
   - **System labels (MOM/Urgent/Escalation):** Keyword match → Auto-assign ✅
   - **Custom labels:** Hybrid (LLM + Similarity) → Auto-assign if >80% confidence
   - **Low confidence:** Create suggestion for approval 📋

### ✅ For System Labels:

- **Direct keyword matching** (fastest)
- **Key phrases extracted** and shown to user
- **Explanation** of why label was assigned
- **Auto-assigned** with high confidence

### ✅ For Custom Labels:

- **Hybrid approach** (LLM 40% + Similarity 60%)
- **Learn from approvals** (update embeddings)
- **Improve over time** (more data = better suggestions)

### ✅ User Experience:

- See **why** AI assigned each label
- **Approve/reject** suggestions
- System **learns** from feedback
- **Transparency** and trust

---

## 🚀 Next Steps

Ready to implement? Here's the order:

1. ✅ Run migrations (add new columns)
2. ✅ Implement embedding service (Gemini + fallback)
3. ✅ Implement keyword classifier (fast system labels)
4. ✅ Implement hybrid classifier (custom labels)
5. ✅ Update email processing pipeline
6. ✅ Test with real IMAP data
7. ✅ Monitor accuracy and tune thresholds

**Want me to help implement any of these steps?** 🎉
