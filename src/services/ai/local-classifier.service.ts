import { Ollama } from '@langchain/ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import dotenv from 'dotenv';
import { client, ensureConnected } from '../../config/db.js';
import { embeddingService } from './embedding.service.js';

dotenv.config();

// Configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

// RAG Configuration
// Options: 'none', 'basic', 'semantic', 'hybrid'
const RAG_MODE = (process.env.RAG_MODE || 'hybrid') as 'none' | 'basic' | 'semantic' | 'hybrid';

// Domain-based classification rules
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
        // Return capitalized category
        return category.charAt(0).toUpperCase() + category.slice(1);
      }
    }
  }

  return null;
}

/**
 * Get similar classified emails for few-shot learning (Diverse approach)
 * Returns one example per label type for diversity
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
    console.log('Could not fetch similar classifications (this is okay for first run):', error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Get semantically similar classified emails using vector embeddings
 * Returns emails that are actually similar in meaning, not just diverse
 */
async function getSemanticallySimilarClassifications(
  subject: string,
  body: string,
  limit: number = 3,
  similarityThreshold: number = 0.6
): Promise<FewShotExample[]> {
  try {
    // 1. Generate embedding for the query email (prefer local for consistency)
    const queryText = `${subject} ${body.substring(0, 2000)}`;
    const embeddingResult = await embeddingService.generateEmbedding(queryText, true);

    if (!embeddingResult) {
      console.log('Could not generate embedding, falling back to basic RAG');
      return [];
    }

    const { embedding, model } = embeddingResult;
    console.log(`🔍 Generated query embedding using ${model} (${embedding.length}D)`);

    // 2. Find similar emails using vector similarity
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
    console.log('Semantic similarity search failed (this is okay):', error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Hybrid RAG: Combine semantic similarity with diverse examples
 * Uses semantic similarity first, falls back to diverse if needed
 */
async function getHybridClassificationExamples(
  subject: string,
  body: string,
  sender: string,
  limit: number = 3
): Promise<FewShotExample[]> {
  // Try semantic similarity first (best for accuracy)
  const semanticExamples = await getSemanticallySimilarClassifications(subject, body, limit, 0.6);

  if (semanticExamples.length >= limit) {
    console.log(`✓ Using ${semanticExamples.length} semantic examples (high similarity)`);
    return semanticExamples;
  }

  // If we don't have enough semantic matches, supplement with diverse examples
  const diverseExamples = await getSimilarClassifications(subject, sender, limit - semanticExamples.length);

  // Combine both, removing duplicates
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

/**
 * Classify email using local LLM (Ollama) via LangChain with enhanced features
 */
export async function classifyEmailLocal(
  subject: string,
  body: string,
  sender: string
): Promise<ClassificationResult> {
  try {
    console.log(`🤖 Using local LLM: ${OLLAMA_MODEL} at ${OLLAMA_BASE_URL}`);

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
    // If RAG_MODE === 'none', examples stays empty

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

    // 3. Initialize Ollama LLM
    const llm = new Ollama({
      baseUrl: OLLAMA_BASE_URL,
      model: OLLAMA_MODEL,
      temperature: 0.1,
    });

    // 4. Create enhanced prompt template
    const promptTemplate = PromptTemplate.fromTemplate(`
You are an expert email classifier. Your job is to accurately categorize emails into specific, meaningful labels.
IMPORTANT: Avoid using "Uncategorized" - every email has a category. Think carefully about the email's purpose and context.

Email Details:
- From: {sender}
- Subject: {subject}
- Body: {body}

Classification Categories (respond with true/false for each):
1. is_hierarchy: Is this from someone in a management/leadership position (boss, manager, director, CEO, VP, senior leadership)?
2. is_client: Is this from an external client, customer, vendor, or partner?
3. is_meeting: Does this email discuss or schedule a meeting, call, or discussion?
4. is_escalation: Does this email have an escalation tone (urgent concerns, issues raised, problems needing attention)?
5. is_urgent: Does the sender request urgent action or immediate response (ASAP, urgent, deadline mentioned)?

Label Suggestion Rules:
- suggested_label: MUST be a specific, descriptive 1-2 word category
- NEVER use "Uncategorized" - if unsure, infer the most likely category from sender domain and content
- Use the category that best describes the email's PRIMARY purpose

Common Email Patterns & Labels:

📧 RECRUITMENT & CAREER:
- Job alerts, interview calls, profile updates → "Recruitment"
- Career opportunities, job matching → "Career"
- Recruiter outreach → "Recruitment"
Examples: emails from jobs.shine.com, hirist.tech, naukri.com

📚 EDUCATION & LEARNING:
- Course invitations, webinars, workshops → "Education"
- Training programs, certifications → "Training"
- Educational content, study materials → "Learning"
Examples: emails from amityonline.com, upgrad.com, coursera.org

📰 NEWSLETTERS & CONTENT:
- Newsletter digests (Medium, Substack, etc.) → "Newsletter"
- Blog updates, content digests → "Content"
- Technical newsletters (CodePen, Dev.to) → "Newsletter"
Examples: emails from medium.com, noreply@medium.com, codepen.io

📱 SOCIAL MEDIA:
- Facebook, LinkedIn, Twitter notifications → "Social"
- Connection requests, messages → "Social"
- Platform updates → "Notification"
Examples: emails from facebook.com, linkedin.com, twitter.com

💰 FINANCE & BANKING:
- Mutual fund updates, investment statements → "Finance"
- Bank statements, transaction alerts → "Banking"
- Portfolio updates → "Investment"
Examples: emails from tatamf.in, icicibank.com, paytm.com

🛍️ COMMERCE & SHOPPING:
- Order confirmations → "Order"
- Shipping updates → "Shipping"
- Payment receipts → "Receipt"
- Promotional offers → "Promotion"

💼 PROFESSIONAL:
- Work projects, tasks → "Project"
- Meetings, schedules → "Meeting"
- Client communication → "Client"
- Invoices, contracts → "Invoice"

🔔 NOTIFICATIONS:
- System alerts, automated updates → "Notification"
- Account activity → "Alert"
- Verification emails → "Verification"

Additional Categories:
- Support, Security, Marketing, Event, Subscription, Health, Travel, Personal{domainHint}{fewShotExamples}

CRITICAL INSTRUCTIONS:
1. Look at the sender domain - it often indicates the category
2. Analyze the subject line - it usually contains clear category hints
3. Check the email body for key terms that indicate purpose
4. If an email mentions "job", "interview", "recruitment" → use "Recruitment"
5. If from educational institutions or learning platforms → use "Education" or "Training"
6. If it's a digest/newsletter → use "Newsletter"
7. If from social media platforms → use "Social"
8. If about finance/investments → use "Finance"
9. NEVER default to "Uncategorized" - make an educated guess based on available clues

Respond ONLY with valid JSON (no markdown, no code blocks, just raw JSON):
{{
  "is_hierarchy": true or false,
  "is_client": true or false,
  "is_meeting": true or false,
  "is_escalation": true or false,
  "is_urgent": true or false,
  "suggested_label": "CategoryName",
  "reasoning": "brief explanation of why this category was chosen"
}}
`);

    // 5. Create JSON output parser
    const parser = new JsonOutputParser<ClassificationResult>();

    // 6. Create chain
    const chain = promptTemplate.pipe(llm).pipe(parser);

    // 7. Execute classification with enhanced context
    const result = await chain.invoke({
      subject: subject,
      body: body.substring(0, 3000), // Increased from 1000 to 3000 chars
      sender: sender,
      domainHint: domainCategory ? `\n\nDomain Hint: This email appears to be from a ${domainCategory} source based on the sender domain.` : '',
      fewShotExamples: fewShotText,
    });

    // 8. Apply domain override if LLM suggests Uncategorized but we detected a domain
    if (result.suggested_label === 'Uncategorized' && domainCategory) {
      result.suggested_label = domainCategory;
      result.reasoning = `Domain-based classification: ${domainCategory} (from ${sender})`;
    }

    console.log(`✓ Local LLM classification successful: ${result.suggested_label}`);
    return result as ClassificationResult;
  } catch (error: any) {
    console.error('Local LLM classification error:', error.message);

    // Fallback: Try domain detection first
    const domainCategory = detectDomainCategory(sender);
    const text = (subject + ' ' + body).toLowerCase();

    return {
      is_hierarchy: /boss|manager|director|ceo|vp|leadership/i.test(text),
      is_client: /client|customer|vendor|partner/i.test(text),
      is_meeting: /meeting|meet|call|discussion|schedule|contract|agreement|decision/i.test(text),
      is_escalation: /escalation|issue|problem|concern|critical/i.test(text),
      is_urgent: /asap|urgent|immediately|deadline|critical/i.test(text),
      suggested_label: domainCategory || 'Uncategorized',
      reasoning: domainCategory
        ? `Fallback domain-based classification (LLM error)`
        : 'Fallback regex classification due to LLM error',
    };
  }
}

/**
 * Test Ollama connection
 */
export async function testOllamaConnection(): Promise<boolean> {
  try {
    const llm = new Ollama({
      baseUrl: OLLAMA_BASE_URL,
      model: OLLAMA_MODEL,
    });

    await llm.invoke('Test');
    console.log(`✓ Ollama connection successful (${OLLAMA_MODEL})`);
    return true;
  } catch (error: any) {
    console.error('❌ Ollama connection failed:', error.message);
    console.error(`   Make sure Ollama is running and model "${OLLAMA_MODEL}" is installed`);
    console.error(`   Install model: ollama pull ${OLLAMA_MODEL}`);
    return false;
  }
}
