import { Ollama } from '@langchain/ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import { JsonOutputParser } from '@langchain/core/output_parsers';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

export interface ClassificationResult {
  is_hierarchy: boolean;
  is_client: boolean;
  is_meeting: boolean;
  is_escalation: boolean;
  is_urgent: boolean;
  suggested_label: string;
  reasoning: string;
}

/**
 * Classify email using local LLM (Ollama) via LangChain
 */
export async function classifyEmailLocal(
  subject: string,
  body: string,
  sender: string
): Promise<ClassificationResult> {
  try {
    console.log(`🤖 Using local LLM: ${OLLAMA_MODEL} at ${OLLAMA_BASE_URL}`);

    // Initialize Ollama LLM
    const llm = new Ollama({
      baseUrl: OLLAMA_BASE_URL,
      model: OLLAMA_MODEL,
      temperature: 0.1,
    });

    // Create prompt template
    const promptTemplate = PromptTemplate.fromTemplate(`
You are an AI email classifier. Analyze the email and classify it according to these categories.

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

Label Suggestion:
- suggested_label: Suggest a short, 1-2 word category label for this email (e.g., "Invoice", "Project", "Personal", "Newsletter", "Support", "HR", "Finance", "Marketing").

Respond ONLY with valid JSON in this format (no markdown, no code blocks, just raw JSON):
{{
  "is_hierarchy": true or false,
  "is_client": true or false,
  "is_meeting": true or false,
  "is_escalation": true or false,
  "is_urgent": true or false,
  "suggested_label": "CategoryName",
  "reasoning": "brief explanation"
}}
`);

    // Create JSON output parser
    const parser = new JsonOutputParser<ClassificationResult>();

    // Create chain
    const chain = promptTemplate.pipe(llm).pipe(parser);

    // Execute classification
    const result = await chain.invoke({
      subject: subject,
      body: body.substring(0, 1000), // Limit body to 1000 chars
      sender: sender,
    });

    console.log(`✓ Local LLM classification successful`);
    return result as ClassificationResult;
  } catch (error: any) {
    console.error('Local LLM classification error:', error.message);

    // Fallback to basic regex if local LLM fails
    const text = (subject + ' ' + body).toLowerCase();
    return {
      is_hierarchy: /boss|manager|director|ceo|vp|leadership/i.test(text),
      is_client: /client|customer|vendor|partner/i.test(text),
      is_meeting: /meeting|meet|call|discussion|schedule/i.test(text),
      is_escalation: /escalation|issue|problem|concern|critical/i.test(text),
      is_urgent: /asap|urgent|immediately|deadline|critical/i.test(text),
      suggested_label: 'Uncategorized',
      reasoning: 'Fallback regex classification due to LLM error',
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
