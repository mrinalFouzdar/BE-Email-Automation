import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

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
 * Classify email using Google Gemini AI
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
    console.log(`🤖 Using Gemini AI: gemini-1.5-flash`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
    // Check if it's a rate limit error
    if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      console.warn('⚠️  Gemini rate limit reached');
      throw new Error('RATE_LIMIT');
    }

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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    await model.generateContent('Test');
    console.log(`✓ Gemini connection successful`);
    return true;
  } catch (error: any) {
    console.error('❌ Gemini connection failed:', error.message);
    return false;
  }
}
