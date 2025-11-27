# 🔍 AI Classification Explanation Feature

## Overview

When AI suggests a system label (MOM, Urgent, Escalation), it will explain **WHY** by showing:
1. **Key phrases** that triggered the classification
2. **Confidence score** (0-100%)
3. **Human-readable explanation**

This builds **trust** and helps users understand AI decisions.

---

## 📊 UI Examples

### Example 1: MOM Classification

```
┌──────────────────────────────────────────────────────┐
│ 📧 Email: Q4 Planning Meeting Summary                │
├──────────────────────────────────────────────────────┤
│ 📊 AI Classification: MOM (95% confidence)           │
│                                                       │
│ 🔍 Why AI thinks this is MOM:                        │
│                                                       │
│ Key Indicators Found:                                │
│   ✓ "meeting minutes" (in subject)                   │
│   ✓ "action items" (in body)                         │
│   ✓ "decisions made" (in body)                       │
│   ✓ "attendees:" (in body)                           │
│                                                       │
│ 💡 Explanation:                                      │
│ This email contains meeting minutes with a clear     │
│ list of attendees, action items, and decisions made  │
│ during the meeting. These are strong indicators of   │
│ a Minutes of Meeting email.                          │
│                                                       │
│ [Auto-Assigned ✅]                                    │
└──────────────────────────────────────────────────────┘
```

### Example 2: Urgent Classification

```
┌──────────────────────────────────────────────────────┐
│ 📧 Email: Server Down - Need Immediate Help!         │
├──────────────────────────────────────────────────────┤
│ 📊 AI Classification: Urgent (92% confidence)        │
│                                                       │
│ 🔍 Why AI thinks this is Urgent:                     │
│                                                       │
│ Key Indicators Found:                                │
│   ⚠️ "URGENT" (in subject)                           │
│   ⚠️ "immediately" (in body)                         │
│   ⚠️ "ASAP" (in body)                                │
│   ⚠️ "critical issue" (in body)                      │
│                                                       │
│ 💡 Explanation:                                      │
│ Email contains multiple urgency indicators including │
│ "URGENT", "immediately", and "ASAP". The subject     │
│ mentions a server outage which requires immediate    │
│ attention.                                           │
│                                                       │
│ [Auto-Assigned ✅]                                    │
└──────────────────────────────────────────────────────┘
```

### Example 3: Escalation Classification

```
┌──────────────────────────────────────────────────────┐
│ 📧 Email: Critical Production Bug - Need Management  │
├──────────────────────────────────────────────────────┤
│ 📊 AI Classification: Escalation (88% confidence)    │
│                                                       │
│ 🔍 Why AI thinks this needs Escalation:              │
│                                                       │
│ Key Indicators Found:                                │
│   🚨 "critical issue" (in subject)                   │
│   🚨 "need management attention" (in body)           │
│   🚨 "escalate to senior team" (in body)             │
│   🚨 "production down" (in body)                     │
│                                                       │
│ 💡 Explanation:                                      │
│ This email describes a critical production issue     │
│ that explicitly requests management attention and    │
│ escalation to the senior team. The severity and      │
│ scope require higher-level involvement.              │
│                                                       │
│ [Auto-Assigned ✅]                                    │
└──────────────────────────────────────────────────────┘
```

### Example 4: Multiple Classifications

```
┌──────────────────────────────────────────────────────┐
│ 📧 Email: Urgent: MOM from Emergency Client Meeting  │
├──────────────────────────────────────────────────────┤
│ 📊 AI Classifications:                               │
│                                                       │
│ 1️⃣ MOM (94% confidence)                              │
│    Key phrases: "meeting minutes", "action items"    │
│                                                       │
│ 2️⃣ Urgent (85% confidence)                           │
│    Key phrases: "urgent", "deadline today"           │
│                                                       │
│ 💡 This email contains meeting minutes from an       │
│    urgent client meeting that requires immediate     │
│    action. Both labels have been applied.            │
│                                                       │
│ [Auto-Assigned Both Labels ✅]                        │
└──────────────────────────────────────────────────────┘
```

---

## 🎯 Database Schema

### pending_label_suggestions table (enhanced):

```sql
CREATE TABLE pending_label_suggestions (
  id SERIAL PRIMARY KEY,
  email_id INT,
  user_id INT,
  suggested_label_name VARCHAR(100),
  confidence_score FLOAT,

  -- NEW: Explanation fields
  key_phrases TEXT[],          -- ["meeting minutes", "action items"]
  explanation TEXT,             -- Human-readable why
  reasoning TEXT,               -- Detailed AI reasoning

  suggestion_method VARCHAR(20), -- 'ai', 'similarity', 'hybrid'
  status VARCHAR(20),           -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMP
);
```

### Example Data:

```json
{
  "id": 123,
  "email_id": 456,
  "suggested_label_name": "MOM",
  "confidence_score": 0.95,
  "key_phrases": [
    "meeting minutes",
    "action items",
    "decisions made",
    "attendees:"
  ],
  "explanation": "Email contains meeting minutes with clear action items, decisions, and attendee list",
  "reasoning": "The email explicitly mentions 'meeting minutes' in the subject and contains structured sections for 'Action Items' and 'Decisions Made' which are strong indicators of a Minutes of Meeting email",
  "suggestion_method": "ai",
  "status": "pending"
}
```

---

## 🔄 Complete Flow with Explanations

### 1. Email Arrives

```
New Email: "MOM - Q4 Review Meeting"
Subject: MOM - Q4 Review Meeting
Body: Please find the meeting minutes attached...
```

### 2. AI Classification with Explanation

```typescript
const result = await classifyEmailWithExplanation(subject, body);

// Result:
{
  label: "MOM",
  confidence: 0.95,
  keyPhrases: [
    "meeting minutes",
    "action items",
    "decisions made",
    "attendees"
  ],
  explanation: "Email contains meeting minutes with action items and decisions",
  reasoning: "Subject contains 'MOM' prefix and body includes structured meeting content"
}
```

### 3. High Confidence → Auto-Assign

```
Confidence: 95% > 80% threshold
→ AUTO-ASSIGN "MOM" label
→ Store explanation for user reference
```

### 4. User Views Email

```
┌─────────────────────────────────────┐
│ 📧 MOM - Q4 Review Meeting          │
│                                      │
│ Labels: [MOM] 🤖 Auto-assigned      │
│                                      │
│ 💡 Why MOM?                         │
│ Found: "meeting minutes",           │
│        "action items"               │
│                                      │
│ [View Details]                      │
└─────────────────────────────────────┘
```

### 5. User Clicks "View Details"

```
┌─────────────────────────────────────────────────────┐
│ 🔍 Classification Explanation                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Label: MOM (Minutes of Meeting)                     │
│ Confidence: 95%                                     │
│ Assigned: Automatically by AI                       │
│                                                      │
│ 📌 Key Indicators Found in Email:                   │
│                                                      │
│ Subject:                                            │
│   • "MOM" prefix                                    │
│                                                      │
│ Body:                                               │
│   • "meeting minutes"                               │
│   • "action items"                                  │
│   • "decisions made"                                │
│   • "attendees:"                                    │
│                                                      │
│ 💡 Why this is MOM:                                 │
│ Email contains meeting minutes with a clear list    │
│ of attendees, action items, and decisions made      │
│ during the meeting. These are strong indicators     │
│ of a Minutes of Meeting email.                      │
│                                                      │
│ 🤖 Classification Method: AI (Gemini)               │
│                                                      │
│ [✓ Correct] [✗ Incorrect] [Suggest Different]      │
└─────────────────────────────────────────────────────┘
```

---

## 🎨 Frontend Component Example

### ClassificationBadge Component

```typescript
interface ClassificationBadgeProps {
  label: string;
  confidence: number;
  keyPhrases: string[];
  explanation: string;
  isAutoAssigned: boolean;
}

function ClassificationBadge({
  label,
  confidence,
  keyPhrases,
  explanation,
  isAutoAssigned
}: ClassificationBadgeProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="classification-badge">
      <div className="badge-header">
        <span className="label-name">{label}</span>
        <span className="confidence">{Math.round(confidence * 100)}%</span>
        {isAutoAssigned && <span className="auto-badge">🤖 Auto</span>}
      </div>

      <button onClick={() => setShowDetails(!showDetails)}>
        💡 Why?
      </button>

      {showDetails && (
        <div className="explanation-panel">
          <h4>🔍 Key Indicators:</h4>
          <ul>
            {keyPhrases.map((phrase, i) => (
              <li key={i}>"{phrase}"</li>
            ))}
          </ul>

          <h4>💡 Explanation:</h4>
          <p>{explanation}</p>
        </div>
      )}
    </div>
  );
}
```

---

## 📊 Analytics Dashboard

Track explanation effectiveness:

```
┌─────────────────────────────────────────────────────┐
│ 📈 AI Explanation Impact                            │
├─────────────────────────────────────────────────────┤
│                                                      │
│ User Feedback on Auto-Assigned Labels:              │
│                                                      │
│ MOM:                                                │
│   ✓ Correct: 95% (142/150)                         │
│   ✗ Incorrect: 5% (8/150)                          │
│   Most common key phrases:                          │
│     1. "meeting minutes" (98% accuracy)             │
│     2. "action items" (96% accuracy)                │
│     3. "decisions made" (94% accuracy)              │
│                                                      │
│ Urgent:                                             │
│   ✓ Correct: 87% (78/90)                           │
│   ✗ Incorrect: 13% (12/90)                         │
│   Most common key phrases:                          │
│     1. "ASAP" (92% accuracy)                        │
│     2. "urgent" (89% accuracy)                      │
│     3. "immediately" (85% accuracy)                 │
│                                                      │
│ Escalation:                                         │
│   ✓ Correct: 91% (64/70)                           │
│   ✗ Incorrect: 9% (6/70)                           │
│   Most common key phrases:                          │
│     1. "escalate" (95% accuracy)                    │
│     2. "critical issue" (93% accuracy)              │
│     3. "management attention" (90% accuracy)        │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 💡 Benefits

### 1. Trust & Transparency
- Users understand WHY AI made decisions
- Builds confidence in AI system

### 2. Training Data
- Track which keywords are most accurate
- Improve classification over time

### 3. User Feedback
- Users can correct wrong classifications
- System learns from corrections

### 4. Debugging
- Easy to see why AI misclassified
- Identify patterns in errors

### 5. Compliance
- Audit trail of AI decisions
- Explainable AI for regulations

---

## 🚀 Implementation Priority

### Phase 1 (High Priority):
✅ Add `key_phrases` and `explanation` columns
✅ Implement `classifyEmailWithExplanation()` function
✅ Show explanations in UI for system labels (MOM/Urgent/Escalation)

### Phase 2 (Medium Priority):
✅ Keyword extraction functions (detectMOMKeywords, etc.)
✅ Analytics dashboard for tracking accuracy
✅ User feedback buttons ("Correct" / "Incorrect")

### Phase 3 (Low Priority):
✅ Highlight key phrases in email preview
✅ Learn from user corrections
✅ Export classification reports

---

## 🎯 Example Prompts for Gemini

### Prompt Template:

```
You are an email classification AI. Analyze this email and determine if it's a MOM email.

Email:
Subject: ${subject}
Body: ${body}

Respond in JSON format:
{
  "isMOM": true/false,
  "confidence": 0.0-1.0,
  "keyPhrases": ["phrase1", "phrase2"],
  "explanation": "Brief explanation why this is/isn't MOM",
  "reasoning": "Detailed reasoning with specific examples from the email"
}

Key indicators for MOM:
- Contains "meeting minutes", "MOM", "action items"
- Lists attendees or participants
- Has structured sections (agenda, decisions, action items)
- Mentions meeting date/time
- Contains follow-up tasks
```

---

## 📝 Summary

With this explanation feature:

1. ✅ **Every AI classification includes:**
   - Confidence score
   - Key phrases that triggered it
   - Human-readable explanation

2. ✅ **Users can:**
   - See why AI made each decision
   - Trust the AI more
   - Provide feedback easily

3. ✅ **System improves over time:**
   - Track which keywords are most accurate
   - Learn from user corrections
   - Build better classification rules

This makes your AI system **transparent, trustworthy, and continuously improving**! 🎉
