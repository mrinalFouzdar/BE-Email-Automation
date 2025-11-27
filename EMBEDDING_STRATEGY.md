# Email Embedding & Label Learning Strategy

## 🎯 Overview

This document outlines the recommended approach for using vector embeddings to improve email classification and label suggestions over time.

---

## 📊 Hybrid Classification Strategy (RECOMMENDED)

### Why Hybrid?

| Approach | Pros | Cons |
|----------|------|------|
| **HYBRID** | ✅ Best of both, learns over time, fallback | More complex implementation |

---

## 🏗️ Architecture

### Phase 1: Email Ingestion & Embedding Generation

```
Admin Creates User with IMAP
    ↓
Fetch All Emails from IMAP
    ↓
For Each Email:
  ├─ Generate Embedding (OpenAI/Gemini/Local) if gemini api key is provided  else do local or if gemini api broke then do local
  ├─ Store in email_meta.embedding
  └─ Classify using Hybrid approach
```

### Phase 2: Hybrid Classification

```python do it in  node js instead of python
def classify_email(email_content):
    # Generate embedding
    embedding = generate_embedding(email_content)

    # Path 1: LLM Classification
    llm_result = classify_with_llm(email_content)
    # Returns: { label: 'MOM', confidence: 0.85 }

    # Path 2: Similarity Search
    similar_emails = find_similar_emails(embedding, limit=5)
    similarity_result = aggregate_labels(similar_emails)
    # Returns: { label: 'MOM', confidence: 0.92, similar_count: 4 }

    # Merge results (weighted average)
    final_result = merge_classifications(llm_result, similarity_result)

    if final_result.confidence > 0.8:
        return AUTO_ASSIGN(final_result.label)
    elif final_result.confidence > 0.5:
        return SUGGEST_FOR_APPROVAL(final_result.label)
    else:
        return REQUEST_MANUAL_LABEL()
```

### Phase 3: Learning from Approvals

```
User Approves Label Suggestion
    ↓
1. Assign label to email
2. Update label_embeddings table:
   ├─ Aggregate this email's embedding with label embedding
   ├─ Use weighted average: (old_emb * old_count + new_emb) / (old_count + 1)
   └─ Increment email_count
    ↓
Future similar emails → Higher confidence suggestions
```

---

## 🗄️ Database Schema

### 1. email_meta (existing, enhanced)
```sql
- email_id
- embedding vector(1536)  -- Email content embedding
- created_at
```

### 2. label_embeddings (NEW)
```sql
- label_id              -- References labels table
- embedding vector(1536) -- Aggregated embedding for this label
- email_count           -- Number of emails contributing
- last_updated
```

**Purpose:** Store a "representative" embedding for each label by averaging embeddings of all emails with that label.

### 3. email_labels (enhanced)
```sql
- email_id
- label_id
- similarity_score      -- NEW: Confidence score (0-1)
- assignment_method     -- NEW: 'manual', 'ai_auto', 'ai_approved', 'similarity'
- assigned_at
```

**Purpose:** Track how labels were assigned and their confidence for analytics.

### 4. pending_label_suggestions (enhanced)
```sql
- email_id
- suggested_label_name
- confidence_score
- similarity_score      -- NEW: Embedding similarity score
- similar_email_ids     -- NEW: Which emails were similar
- suggestion_method     -- NEW: 'ai', 'similarity', 'hybrid'
- status               -- 'pending', 'approved', 'rejected'
```

---

## 🔄 Complete Flow Example

### Scenario: Admin adds user john@company.com

**Step 1: Fetch Emails**
```
- Fetched 500 emails from IMAP
- Total: 500 emails
```

**Step 2: Process Each Email**

**Email #1:** "Meeting minutes attached for Q4 review"
```
1. Generate Embedding:
   embedding = [0.123, -0.456, 0.789, ...] (1536 dims)

2. LLM Classification (Gemini):
   Result: { label: 'MOM', confidence: 0.95, reasoning: 'Contains meeting minutes' }

3. Similarity Search:
   - Found 0 similar emails (first email in system)
   - Result: None

4. Decision:
   - Confidence: 0.95 (high) → AUTO-ASSIGN 'MOM' label
   - assignment_method: 'ai_auto'

5. Update label_embeddings:
   - Create entry for 'MOM' label with this embedding
   - email_count: 1
```

**Email #2:** "Meeting notes from yesterday's standup"
```
1. Generate Embedding:
   embedding = [0.125, -0.451, 0.792, ...] (very similar to Email #1)

2. LLM Classification (Gemini):
   Result: { label: 'MOM', confidence: 0.88 }

3. Similarity Search:
   - Found Email #1 (similarity: 0.94)
   - Email #1 has label: 'MOM'
   - Result: { label: 'MOM', confidence: 0.94, similar_count: 1 }

4. Merge Results:
   - LLM: 0.88, Similarity: 0.94
   - Final: (0.88 * 0.5 + 0.94 * 0.5) = 0.91

5. Decision:
   - Confidence: 0.91 (high) → AUTO-ASSIGN 'MOM' label
   - assignment_method: 'hybrid'

6. Update label_embeddings for 'MOM':
   - new_embedding = (old_embedding * 1 + new_embedding) / 2
   - email_count: 2
```

**Email #200:** "Can you send me the project files?"
```
1. Generate Embedding:
   embedding = [0.892, -0.123, 0.456, ...] (different from MOM emails)

2. LLM Classification (Gemini):
   Result: { label: 'Project Request', confidence: 0.65 }

3. Similarity Search:
   - No similar emails found (low similarity < 0.5)
   - Result: None

4. Decision:
   - Confidence: 0.65 (medium) → SUGGEST for approval
   - Create pending_label_suggestion:
     - suggested_label_name: 'Project Request'
     - confidence_score: 0.65
     - suggestion_method: 'ai'
     - status: 'pending'
```

**Admin Reviews Suggestions:**
```
Admin sees: "Project Request" label suggestion for Email #200

Admin Action: APPROVE

Result:
1. Assign 'Project Request' label to Email #200
2. Create label_embeddings entry for 'Project Request'
3. Future similar emails → Suggest 'Project Request' with higher confidence
```

**Email #201:** "Please share the design documents"
```
1. Generate Embedding:
   embedding = [0.885, -0.119, 0.461, ...] (very similar to Email #200)

2. LLM Classification:
   Result: { label: 'Project Request', confidence: 0.70 }

3. Similarity Search:
   - Found Email #200 (similarity: 0.91)
   - Email #200 has label: 'Project Request' (user-approved)
   - Result: { label: 'Project Request', confidence: 0.91 }

4. Merge Results:
   - Final: (0.70 * 0.5 + 0.91 * 0.5) = 0.805

5. Decision:
   - Confidence: 0.805 (high) → AUTO-ASSIGN 'Project Request'
   - System learned from admin's approval! ✅
```

---

## 🧮 Embedding Generation Options

### Option 2: Google Gemini (FREE, Good Quality)
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateEmbedding(text: string) {
  const model = genAI.getGenerativeModel({ model: 'embedding-001' });
  const result = await model.embedContent(text);
  return result.embedding.values;  // 768 dimensions
}
```

**Cost:** FREE (15 req/min, 1500 req/day)
**Pros:** Free, integrated with existing Gemini usage
**Cons:** 768 dims (need to update schema), rate limited

### Option 3: Local Embeddings (Self-hosted, Free)
```typescript
// Using sentence-transformers via Python bridge or ONNX
// Models: all-MiniLM-L6-v2 (384 dims), mpnet-base-v2 (768 dims)
```

**Cost:** FREE (hardware cost only)
**Pros:** Fully local, no API limits, privacy
**Cons:** Slower, setup complexity, smaller dimensions

---

## 📈 Performance Improvements Over Time

### Metrics to Track:

1. **Auto-assignment Rate:**
   - Week 1: 30% auto-assigned (only system labels)
   - Week 4: 65% auto-assigned (learned custom labels)
   - Week 12: 85% auto-assigned (mature system)

2. **Suggestion Accuracy:**
   - Approved suggestions / Total suggestions
   - Target: >80%

3. **Label Embedding Quality:**
   - Average similarity within label: Should be high (>0.7)
   - Average similarity between labels: Should be low (<0.5)

---

## 🎛️ Configuration Recommendations

### Confidence Thresholds:

```typescript
const CONFIG = {
  AUTO_ASSIGN_THRESHOLD: 0.80,  // Auto-assign if confidence > 80%
  SUGGEST_THRESHOLD: 0.50,       // Suggest if confidence > 50%
  MIN_SIMILAR_EMAILS: 2,         // Need 2+ similar emails for similarity-based suggestion
  SIMILARITY_WEIGHT: 0.6,        // Weight similarity 60% vs LLM 40%
  MIN_SIMILARITY_SCORE: 0.70,    // Only consider emails with >70% similarity
};
```

### System Labels (Always LLM-based):
- MOM (Minutes of Meeting)
- Urgent
- Escalation 
if any email has any word then assign directly to that label

**Reason:** These require deep semantic understanding, not just similarity.

### Custom Labels (Hybrid):
- Project Request
- Client Inquiry
- Bug Report
- Feature Request
- etc.

**Reason:** Learn from user behavior, improve over time.

---

## 🔄 Recommended Implementation Plan

- ✅ Add embedding columns to schema
- ✅ Integrate embedding generation (choose provider)
- ✅ Store embeddings for all new emails

- ✅ Implement similarity search function
- ✅ Create label_embeddings aggregation
- ✅ Test similarity-based suggestions

- ✅ Combine LLM + similarity results
- ✅ Implement confidence merging
- ✅ Add auto-assignment logic

- ✅ Update embeddings on approval
- ✅ Track metrics and accuracy
- ✅ Fine-tune thresholds

---

## 💡 Best Practices

### DO:
✅ Generate embeddings for email subject + body (combined)
✅ Normalize embeddings before storage
✅ Update label embeddings incrementally (weighted average)
✅ Track assignment methods for analytics
✅ Set reasonable confidence thresholds (80% for auto-assign)
✅ Show similar emails when suggesting labels (transparency)



---

## 📊 Example Analytics Dashboard

```
Label Learning Performance:

Label: "Project Request"
- Emails: 45
- Auto-assigned: 32 (71%)
- Suggested & Approved: 13 (29%)
- Avg Similarity: 0.82 ✅
- Confidence Trend: ↑ 15% (week-over-week)

Label: "MOM"
- Emails: 123
- Auto-assigned: 118 (96%)
- Suggested & Approved: 5 (4%)
- Avg Similarity: 0.91 ✅
- Confidence Trend: → Stable

Overall System:
- Total Emails: 1,234
- Auto-assigned: 1,050 (85%)
- Pending Suggestions: 12
- Suggestion Approval Rate: 87% ✅
```

---

## 🎯 Expected Benefits

1. **Reduced Manual Work:** 85% auto-assignment after 3 months
2. **Better Accuracy:** Learn from user preferences
3. **Faster Processing:** Similarity search is faster than LLM
4. **Cost Savings:** Fewer LLM API calls
5. **Personalization:** Each user's label preferences learned over time
6. **Transparency:** Show why a label was suggested (similar emails)

---

## 🚀 Next Steps

1. Choose embedding provider (recommend: Gemini for free tier)
2. Run migration to add label_embeddings table
3. Update email processing pipeline to generate embeddings
4. Implement hybrid classification service
5. Add analytics dashboard to track performance
6. Monitor and tune confidence thresholds
