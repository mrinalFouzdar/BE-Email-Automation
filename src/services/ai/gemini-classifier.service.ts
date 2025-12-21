import { GoogleGenerativeAI } from '@google/generative-ai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';
import dotenv from 'dotenv';
import { client, ensureConnected } from '../../config/db.js';
import { embeddingService } from './embedding.service.js';

dotenv.config();

// RAG Configuration (same as local classifier)
const RAG_MODE = (process.env.RAG_MODE || 'hybrid') as 'none' | 'basic' | 'semantic' | 'hybrid';

// Domain-based classification rules (same as local classifier)
const DOMAIN_PATTERNS = {
  newsletter: ['medium.com', 'substack.com', 'beehiiv.com', 'mailchimp.com', 'buttondown.email', 'digest@', 'newsletter@', 'noreply@'],
  social: ['linkedin.com', 'twitter.com', 'facebook.com', 'instagram.com', 'notifications@'],
  automated: ['noreply@', 'no-reply@', 'donotreply@', 'notification@', 'automated@'],
  ecommerce: ['amazon.com', 'ebay.com', 'shopify.com', 'paypal.com', 'stripe.com'],
  recruitment: ['indeed.com', 'glassdoor.com', 'linkedin.com', 'hired.com', 'jobs@', 'careers@'],
};

export interface ClassificationResult {
  is_hierarchy: boolean;
  is_client: boolean;
  is_meeting: boolean;
  is_escalation: boolean;
  is_urgent: boolean;
  suggested_label: string;
  reasoning: string;
  confidence?: number; // Added for better transparency
}

export interface FewShotExample {
  subject: string;
  sender: string;
  suggested_label: string;
  reasoning: string;
  similarity?: number; // Optional: Only present for semantic similarity
}

/**
 * Detect email category based on sender domain
 */
function detectDomainCategory(sender: string): string | null {
  const senderLower = sender.toLowerCase();

  for (const [category, patterns] of Object.entries(DOMAIN_PATTERNS)) {
    for (const pattern of patterns) {
      if (senderLower.includes(pattern)) {
        return category.charAt(0).toUpperCase() + category.slice(1);
      }
    }
  }

  return null;
}

/**
 * Get similar classified emails for few-shot learning (Diverse approach)
 */
async function getSimilarClassifications(subject: string, sender: string, limit: number = 3): Promise<FewShotExample[]> {
  try {
    await ensureConnected();

    const query = `
      SELECT DISTINCT ON (em.classification->>'suggested_label')
        e.subject,
        e.sender,
        em.classification->>'suggested_label' as suggested_label,
        em.classification->>'reasoning' as reasoning
      FROM emails e
      JOIN email_meta em ON e.id = em.email_id
      WHERE em.classification IS NOT NULL
        AND em.classification->>'suggested_label' != 'Uncategorized'
        AND em.classification->>'suggested_label' IS NOT NULL
      ORDER BY em.classification->>'suggested_label', em.updated_at DESC
      LIMIT $1;
    `;

    const result = await client.query(query, [limit]);
    return result.rows.map((row: any) => ({
      subject: row.subject,
      sender: row.sender,
      suggested_label: row.suggested_label,
      reasoning: row.reasoning || 'Previous classification'
    }));
  } catch (error) {
    console.log('Could not fetch similar classifications:', error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Get semantically similar classified emails using vector embeddings
 */
async function getSemanticallySimilarClassifications(
  subject: string,
  body: string,
  limit: number = 3,
  similarityThreshold: number = 0.6
): Promise<FewShotExample[]> {
  try {
    const queryText = `${subject} ${body.substring(0, 2000)}`;
    const embeddingResult = await embeddingService.generateEmbedding(queryText, false);

    if (!embeddingResult) {
      return [];
    }

    const { embedding, model } = embeddingResult;
    console.log(`🔍 Generated query embedding using ${model} (${embedding.length}D)`);

    await ensureConnected();

    const embeddingStr = `[${embedding.join(',')}]`;
    const distanceThreshold = 1 - similarityThreshold;

    const query = `
      SELECT
        e.subject,
        e.sender,
        em.classification->>'suggested_label' as suggested_label,
        em.classification->>'reasoning' as reasoning,
        (1 - (em.embedding <=> $1::vector)) as similarity
      FROM email_meta em
      JOIN emails e ON e.id = em.email_id
      WHERE em.embedding IS NOT NULL
        AND em.embedding_model = $2
        AND em.classification IS NOT NULL
        AND em.classification->>'suggested_label' != 'Uncategorized'
        AND em.classification->>'suggested_label' IS NOT NULL
        AND (em.embedding <=> $1::vector) < $3
      ORDER BY similarity DESC
      LIMIT $4;
    `;

    const result = await client.query(query, [embeddingStr, model, distanceThreshold, limit]);

    console.log(`✓ Found ${result.rows.length} semantically similar emails (avg similarity: ${
      result.rows.length > 0
        ? (result.rows.reduce((sum: number, r: any) => sum + r.similarity, 0) / result.rows.length).toFixed(2)
        : 'N/A'
    })`);

    return result.rows.map((row: any) => ({
      subject: row.subject,
      sender: row.sender,
      suggested_label: row.suggested_label,
      reasoning: row.reasoning || 'Previous classification',
      similarity: row.similarity
    }));
  } catch (error) {
    console.log('Semantic similarity search failed:', error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Hybrid RAG: Combine semantic similarity with diverse examples
 */
async function getHybridClassificationExamples(
  subject: string,
  body: string,
  sender: string,
  limit: number = 3
): Promise<FewShotExample[]> {
  const semanticExamples = await getSemanticallySimilarClassifications(subject, body, limit, 0.6);

  if (semanticExamples.length >= limit) {
    console.log(`✓ Using ${semanticExamples.length} semantic examples (high similarity)`);
    return semanticExamples;
  }

  const diverseExamples = await getSimilarClassifications(subject, sender, limit - semanticExamples.length);

  const combined = [...semanticExamples];
  const seenLabels = new Set(semanticExamples.map(ex => ex.suggested_label));

  for (const ex of diverseExamples) {
    if (!seenLabels.has(ex.suggested_label) && combined.length < limit) {
      combined.push(ex);
      seenLabels.add(ex.suggested_label);
    }
  }

  console.log(`✓ Using hybrid approach: ${semanticExamples.length} semantic + ${combined.length - semanticExamples.length} diverse`);
  return combined;
}

// Zod schema for structured output
const classificationSchema = z.object({
  is_hierarchy: z.boolean().describe('Is this from management/leadership?'),
  is_client: z.boolean().describe('Is this from external client/customer?'),
  is_meeting: z.boolean().describe('Does this discuss or schedule a meeting?'),
  is_escalation: z.boolean().describe('Does this have escalation tone?'),
  is_urgent: z.boolean().describe('Does sender request urgent action?'),
  suggested_label: z.string().describe('Short 1-2 word category label'),
  reasoning: z.string().describe('Brief explanation for the classification'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1')
});

/**
 * Classify email using LangChain + Gemini with RAG-enhanced structured output
 */
export async function classifyEmailGemini(
  subject: string,
  body: string,
  sender: string
): Promise<ClassificationResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  try {
    console.log(`🤖 Using LangChain + Gemini with RAG: gemini-2.5-flash`);

    // 1. Check domain-based detection first
    const domainCategory = detectDomainCategory(sender);
    if (domainCategory) {
      console.log(`✓ Domain-based detection: ${domainCategory} (from ${sender})`);
    }

    // 2. Get few-shot examples based on RAG_MODE configuration
    let examples: FewShotExample[] = [];

    if (RAG_MODE === 'hybrid') {
      examples = await getHybridClassificationExamples(subject, body, sender, 3);
    } else if (RAG_MODE === 'semantic') {
      examples = await getSemanticallySimilarClassifications(subject, body, 3, 0.6);
    } else if (RAG_MODE === 'basic') {
      examples = await getSimilarClassifications(subject, sender, 3);
    }

    const fewShotText = examples.length > 0
      ? `\n\nHere are some examples of previous email classifications to guide you:\n${examples
          .map(
            (ex, i) =>
              `Example ${i + 1}:${ex.similarity ? ` (${(ex.similarity * 100).toFixed(0)}% similar)` : ''}\n  Subject: "${ex.subject}"\n  From: ${ex.sender}\n  Label: ${ex.suggested_label}\n  Reasoning: ${ex.reasoning}`
          )
          .join('\n\n')}`
      : '';

    if (examples.length > 0) {
      console.log(`✓ Using RAG mode: ${RAG_MODE} (${examples.length} examples)`);
    }

    // 3. Use LangChain for structured output
    const llm = new ChatGoogleGenerativeAI({
      model: 'gemini-2.0-flash',
      apiKey: apiKey,
      temperature: 0.2, // Lower temperature for more consistent classification
    });

    const structuredLLM = llm.withStructuredOutput(classificationSchema);

    // 4. Enhanced prompt with RAG examples
    const prompt = `You are an AI email classifier. Analyze the email and classify it.

Email Details:
- From: ${sender}
- Subject: ${subject}
- Body: ${body.substring(0, 3000)}

Classification Guidelines:
1. is_hierarchy: From boss, manager, director, CEO, VP, senior leadership?
2. is_client: From external client, customer, vendor, or partner?
3. is_meeting: Discusses or schedules a meeting, call, or discussion?
4. is_escalation: Has escalation tone (urgent concerns, issues, problems)?
5. is_urgent: Requests urgent action or immediate response (ASAP, deadline)?

Label Suggestion:
- Suggest a short, 1-2 word category label for this email.

Common Categories by Type:
- Work: Project, Meeting, Invoice, Report, Contract, Proposal, Review, Approval, Task
- Communication: Newsletter, Digest, Article, Blog, Update, Announcement, Alert, Notification
- Social: LinkedIn, Social, Connection, Invitation, Event
- Commerce: Order, Receipt, Shipping, Payment, Subscription, Purchase
- HR/Admin: HR, Payroll, Benefits, Training, Policy, Onboarding
- Tech: Support, Bug, Feature, Deployment, Maintenance, Security
- Marketing: Marketing, Campaign, Promotion, Webinar, Demo
- Automated: Automated, System, Backup, Report, Monitoring
- Recruitment: Job, Career, Interview, Application, Candidate
- Personal: Personal, Travel, Health, Finance, Education

Guidelines:
- For newsletters/digests from platforms (Medium, Substack, LinkedIn), use "Newsletter" or "Content"
- For automated notifications, use "Notification" or "Automated"
- For social media updates, use "Social" or the platform name
- For transactional emails (receipts, orders), use specific types like "Receipt", "Order", "Shipping"
- For work-related project emails, use "Project" or the specific project/topic name
- Be specific when possible (e.g., "Invoice" instead of "Finance" for billing emails)${domainCategory ? `\n\nDomain Hint: This email appears to be from a ${domainCategory} source based on the sender domain.` : ''}${fewShotText}

Important:
- Avoid system labels: "Escalation", "Urgent", "MOM" (these are auto-assigned)
- Provide clear reasoning for your suggestion
- Assign confidence score (0.0 to 1.0) based on how clear the email's category is

Respond with structured classification.`;

    const result = await structuredLLM.invoke(prompt);

    // 5. Apply domain override if Gemini suggests Uncategorized but we detected a domain
    if (result.suggested_label === 'Uncategorized' && domainCategory) {
      result.suggested_label = domainCategory;
      result.reasoning = `Domain-based classification: ${domainCategory} (from ${sender})`;
    }

    console.log(`✓ Gemini + RAG classification successful: ${result.suggested_label} (confidence: ${result.confidence?.toFixed(2)})`);

    return result as ClassificationResult;
  } catch (error: any) {
    // Check if it's a rate limit error
    if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      console.warn('⚠️  Gemini rate limit reached');
      throw new Error('RATE_LIMIT');
    }

    console.error('LangChain classification error:', error.message);
    throw error;
  }
}

/**
 * Fallback: Original Gemini implementation (without LangChain)
 * Used if LangChain fails
 */
export async function classifyEmailGeminiLegacy(
  subject: string,
  body: string,
  sender: string
): Promise<ClassificationResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  try {
    console.log(`🤖 Using Gemini AI (Legacy): gemini-2.5-flash`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are an AI email classifier. Analyze the email and classify it according to these categories.

Email Details:
- From: ${sender}
- Subject: ${subject}
- Body: ${body.substring(0, 1000)}

Classification Categories (respond with true/false for each):
1. is_hierarchy: Is this from someone in a management/leadership position (boss, manager, director, CEO, VP, senior leadership)?
2. is_client: Is this from an external client, customer, vendor, or partner?
3. is_meeting: Does this email discuss or schedule a meeting, call, or discussion?
4. is_escalation: Does this email have an escalation tone (urgent concerns, issues raised, problems needing attention)?
5. is_urgent: Does the sender request urgent action or immediate response (ASAP, urgent, deadline mentioned)?

Label Suggestion:
- suggested_label: Suggest a short, 1-2 word category label for this email (e.g., "Invoice", "Project", "Personal", "Newsletter", "Support", "HR", "Finance", "Marketing").

Respond ONLY with valid JSON in this format (no markdown, no code blocks, just raw JSON):
{
  "is_hierarchy": true or false,
  "is_client": true or false,
  "is_meeting": true or false,
  "is_escalation": true or false,
  "is_urgent": true or false,
  "suggested_label": "CategoryName",
  "reasoning": "brief explanation"
}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from Gemini');
    }

    const classification = JSON.parse(jsonMatch[0]);
    console.log(`✓ Gemini classification successful`);

    return classification as ClassificationResult;
  } catch (error: any) {
    console.error('Gemini classification error:', error.message);
    throw error;
  }
}

/**
 * Test Gemini connection
 */
export async function testGeminiConnection(): Promise<boolean> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log('⚠️  GEMINI_API_KEY not configured');
    return false;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    await model.generateContent('Test');
    console.log(`✓ Gemini connection successful`);
    return true;
  } catch (error: any) {
    console.error('❌ Gemini connection failed:', error.message);
    return false;
  }
}
