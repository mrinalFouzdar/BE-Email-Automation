/**
 * Explainable Email Classifier
 *
 * This service provides AI classification with explanations:
 * - Identifies system labels (MOM, Urgent, Escalation)
 * - Extracts key phrases that triggered the classification
 * - Provides human-readable explanation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface ClassificationResult {
  label: string;
  confidence: number;
  keyPhrases: string[];
  explanation: string;
  reasoning: string;
}

/**
 * Classify email with explanation of WHY
 */
export async function classifyEmailWithExplanation(
  subject: string,
  body: string
): Promise<ClassificationResult[]> {
  const emailContent = `Subject: ${subject}\n\nBody: ${body}`;

  const prompt = `You are an email classification AI. Analyze this email and classify it into these categories:

1. **MOM (Minutes of Meeting)**: Emails containing meeting notes, action items, decisions, or summaries
2. **Urgent**: Emails requiring immediate attention with deadlines or critical issues
3. **Escalation**: Emails about problems that need higher management attention

For EACH applicable category, provide:
1. Confidence score (0-1)
2. Key phrases from the email that indicate this category (exact quotes)
3. Brief explanation WHY this category applies

Email:
${emailContent}

Respond in this EXACT JSON format:
{
  "classifications": [
    {
      "label": "MOM",
      "confidence": 0.95,
      "keyPhrases": ["meeting minutes", "action items", "decisions made"],
      "explanation": "Email contains meeting minutes with action items and decisions",
      "reasoning": "The email explicitly mentions 'meeting minutes' and lists 'action items' and 'decisions made' which are strong indicators of a MOM email"
    }
  ]
}

Only include categories with confidence > 0.5. Return empty array if no categories match.`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonStr);
    return parsed.classifications || [];

  } catch (error: any) {
    console.error('❌ Classification error:', error.message);
    return [];
  }
}

/**
 * Format classification for display to user/admin
 */
export function formatClassificationExplanation(result: ClassificationResult): string {
  const phrases = result.keyPhrases.map(p => `"${p}"`).join(', ');

  return `📊 **${result.label}** (${Math.round(result.confidence * 100)}% confidence)

🔍 **Key Indicators:**
${result.keyPhrases.map(p => `   • "${p}"`).join('\n')}

💡 **Why:** ${result.explanation}`;
}

/**
 * Example: Detect MOM-specific keywords
 */
export function detectMOMKeywords(text: string): string[] {
  const momPatterns = [
    // Meeting references
    /meeting (minutes|notes|summary)/gi,
    /minutes of (the )?meeting/gi,
    /mom attached/gi,

    // Action items
    /action items?/gi,
    /to[- ]?do:?/gi,
    /next steps?/gi,
    /follow[- ]?ups?/gi,

    // Decisions
    /decisions? (made|taken)/gi,
    /agreed (to|that|on)/gi,
    /consensus/gi,

    // Participants
    /attendees?:/gi,
    /participants?:/gi,
    /present:/gi,

    // Agenda items
    /agenda/gi,
    /discussed:/gi,
    /topics? covered/gi
  ];

  const keywords: string[] = [];
  const lowerText = text.toLowerCase();

  for (const pattern of momPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      keywords.push(...matches);
    }
  }

  // Remove duplicates
  return [...new Set(keywords)];
}

/**
 * Example: Detect Urgent keywords
 */
export function detectUrgentKeywords(text: string): string[] {
  const urgentPatterns = [
    // Explicit urgency
    /\b(urgent|asap|immediately|critical)\b/gi,
    /high priority/gi,
    /time[- ]sensitive/gi,

    // Deadlines
    /deadline:?\s*today/gi,
    /due (today|tomorrow|this week)/gi,
    /by (EOD|COB|end of day)/gi,

    // Requests
    /need.*?(asap|urgently|immediately)/gi,
    /please.*?(urgent|asap)/gi,

    // Indicators
    /⚠️|🚨|‼️|❗/g,
    /\[URGENT\]/gi,
    /IMPORTANT:/gi
  ];

  const keywords: string[] = [];

  for (const pattern of urgentPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      keywords.push(...matches);
    }
  }

  return [...new Set(keywords)];
}

/**
 * Example: Detect Escalation keywords
 */
export function detectEscalationKeywords(text: string): string[] {
  const escalationPatterns = [
    // Escalation references
    /escalat(e|ed|ing)/gi,
    /need.*?management.*?attention/gi,
    /inform.*?senior/gi,

    // Problems
    /critical (issue|problem|bug)/gi,
    /major (incident|outage|failure)/gi,
    /production (down|issue)/gi,

    // Requests for help
    /need.*?help.*?urgent/gi,
    /require.*?immediate.*?assistance/gi,
    /please.*?review.*?urgent/gi,

    // Severity indicators
    /sev[- ]?1/gi,
    /p[- ]?0/gi,
    /emergency/gi
  ];

  const keywords: string[] = [];

  for (const pattern of escalationPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      keywords.push(...matches);
    }
  }

  return [...new Set(keywords)];
}

/**
 * Quick keyword-based classification (fallback if LLM fails)
 */
export function quickClassifyWithKeywords(subject: string, body: string): {
  label: string;
  confidence: number;
  keyPhrases: string[];
}[] {
  const fullText = `${subject} ${body}`;
  const results: { label: string; confidence: number; keyPhrases: string[] }[] = [];

  // Check MOM
  const momKeywords = detectMOMKeywords(fullText);
  if (momKeywords.length >= 2) {
    results.push({
      label: 'MOM',
      confidence: Math.min(0.6 + (momKeywords.length * 0.1), 0.95),
      keyPhrases: momKeywords.slice(0, 5)
    });
  }

  // Check Urgent
  const urgentKeywords = detectUrgentKeywords(fullText);
  if (urgentKeywords.length >= 1) {
    results.push({
      label: 'Urgent',
      confidence: Math.min(0.5 + (urgentKeywords.length * 0.15), 0.9),
      keyPhrases: urgentKeywords.slice(0, 5)
    });
  }

  // Check Escalation
  const escalationKeywords = detectEscalationKeywords(fullText);
  if (escalationKeywords.length >= 1) {
    results.push({
      label: 'Escalation',
      confidence: Math.min(0.5 + (escalationKeywords.length * 0.15), 0.9),
      keyPhrases: escalationKeywords.slice(0, 5)
    });
  }

  return results;
}

// Example usage
export async function exampleUsage() {
  const email = {
    subject: 'MOM - Q4 Planning Meeting',
    body: `Hi team,

Please find attached the meeting minutes from yesterday's Q4 planning session.

**Attendees:** John, Sarah, Mike

**Action Items:**
1. John to prepare budget proposal by Friday
2. Sarah to schedule follow-up meeting
3. Mike to review vendor contracts

**Decisions Made:**
- Approved new hiring plan
- Agreed on Q4 marketing budget

Let me know if you have any questions.

Best,
Alice`
  };

  console.log('🔍 Classifying email with explanation...\n');

  const results = await classifyEmailWithExplanation(email.subject, email.body);

  for (const result of results) {
    console.log(formatClassificationExplanation(result));
    console.log('\n---\n');
  }

  // Example output:
  /*
  📊 **MOM** (95% confidence)

  🔍 **Key Indicators:**
     • "meeting minutes"
     • "action items"
     • "decisions made"
     • "attendees"

  💡 **Why:** Email contains meeting minutes with clear action items, decisions, and attendee list
  */
}
