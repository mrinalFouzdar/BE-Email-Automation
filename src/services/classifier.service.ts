// COMMENTED OUT - Using local LLM instead of OpenAI
// import OpenAI from 'openai';
import dotenv from 'dotenv';
import { withRetry } from '../utils/rate-limiter';
import { classifyEmailDynamic } from './dynamic-classifier.service';

dotenv.config();

// COMMENTED OUT - Using local LLM instead
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
 * Main classification function - uses DYNAMIC LLM selection
 *
 * Priority:
 * 1. Gemini (if API key present and not rate limited)
 * 2. Local LLM (Ollama fallback)
 * 3. Regex (final fallback)
 */
export async function classifyEmail(subject: string, body: string, sender: string): Promise<ClassificationResult> {
  // Use dynamic classifier (Gemini first, then Local LLM)
  return classifyEmailDynamic(subject, body, sender);
}

/**
 * COMMENTED OUT - OpenAI classification (kept for reference)
 * Uncomment this and remove the local LLM call above to use OpenAI again
 */
/*
export async function classifyEmailOpenAI(subject: string, body: string, sender: string): Promise<ClassificationResult> {
  const prompt = `Analyze this email and classify it according to these categories:

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

Respond ONLY with valid JSON in this format:
{
  "is_hierarchy": true/false,
  "is_client": true/false,
  "is_meeting": true/false,
  "is_escalation": true/false,
  "is_urgent": true/false,
  "suggested_label": "CategoryName",
  "reasoning": "brief explanation"
}`;

  try {
    // Use retry logic to handle rate limits
    const response = await withRetry(
      async () => {
        return await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        });
      },
      3, // Max 3 retries
      2000 // 2 second base delay
    );

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result as ClassificationResult;
  } catch (error) {
    console.error('OpenAI classification error:', error);
    // Fallback to basic regex if OpenAI fails
    const text = (subject + ' ' + body).toLowerCase();
    return {
      is_hierarchy: /boss|manager|director|ceo|vp|leadership/i.test(text),
      is_client: /client|customer|vendor|partner/i.test(text),
      is_meeting: /meeting|meet|call|discussion|schedule/i.test(text),
      is_escalation: /escalation|issue|problem|concern|critical/i.test(text),
      is_urgent: /asap|urgent|immediately|deadline|critical/i.test(text),
      suggested_label: 'Uncategorized',
      reasoning: 'Fallback regex classification due to API error'
    };
  }
}
*/
