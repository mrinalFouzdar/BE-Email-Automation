import { ChatOpenAI } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { OllamaEmbeddings } from '@langchain/ollama';
import { client } from '../../config/db';
import { classifyEmailLocal } from '../../services/ai/local-classifier.service';
import dotenv from 'dotenv';
dotenv.config();

interface EmailData {
  subject: string;
  body: string;
  sender: string;
  senderName: string;
  receivedAt: string;
}

interface ClassificationResult {
  emailId: number;
  labels: {
    is_hierarchy: boolean;
    is_client: boolean;
    is_meeting: boolean;
    is_escalation: boolean;
    is_urgent: boolean;
  };
  reasoning: string;
}

// Multi-Agent System Components
export class EmailClassifierAgent {
  private llm: ChatOpenAI | ChatGoogleGenerativeAI;

  constructor() {
    // Priority: 1. Gemini → 2. OpenAI → 3. Local LLM
    if (process.env.GEMINI_API_KEY) {
      this.llm = new ChatGoogleGenerativeAI({
        model: 'gemini-2.0-flash',
        maxOutputTokens: 2048,
        apiKey: process.env.GEMINI_API_KEY,
      });
      console.log('✅ Using Gemini for classification');
    } else if (process.env.OPENAI_API_KEY) {
      this.llm = new ChatOpenAI({
        modelName: 'gpt-4o-mini',
        temperature: 0.1,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
      console.log('✅ Using OpenAI for classification');
    } else {
      // Fallback to local LLM if no API keys found
      console.log('⚠️  No AI API keys found, will use local LLM fallback');
      this.llm = null as any;
    }
  }

  async classify(emailData: EmailData): Promise<{ result: any; usedLocal: boolean }> {
    const prompt = `You are an expert email classifier agent. Analyze the following email and classify it into categories.

Email Details:
- From: ${emailData.senderName} <${emailData.sender}>
- Subject: ${emailData.subject}
- Body: ${emailData.body.substring(0, 2000)}
- Received: ${emailData.receivedAt}

Classification Categories:
1. is_hierarchy: Is this from someone in management/leadership (boss, manager, director, CEO, VP, C-level)?
2. is_client: Is this from an external client, customer, vendor, or business partner?
3. is_meeting: Does this discuss or schedule a meeting, call, video conference, or discussion?
4. is_escalation: Does this have escalation tone (urgent concerns, issues raised, problems needing attention)?
5. is_urgent: Does the sender request urgent action or immediate response (ASAP, urgent, critical, deadline)?

Label Suggestion:
- suggested_label: Suggest a short, 1-2 word category label for this email (e.g., "Invoice", "Project", "Newsletter", "Support", "HR", "Finance", "Marketing").

Respond with ONLY valid JSON in this exact format:
{
  "is_hierarchy": true/false,
  "is_client": true/false,
  "is_meeting": true/false,
  "is_escalation": true/false,
  "is_urgent": true/false,
  "suggested_label": "CategoryName",
  "reasoning": "Brief explanation of classification decisions"
}`;

    // Try Gemini first
    if (process.env.GEMINI_API_KEY) {
      try {
        const geminiLLM = new ChatGoogleGenerativeAI({
          model: 'gemini-2.0-flash',
          maxOutputTokens: 2048,
          apiKey: process.env.GEMINI_API_KEY,
        });
        const response = await geminiLLM.invoke(prompt);
        const classification = JSON.parse(response.content as string);
        console.log('✅ Classified using Gemini');
        return { result: classification, usedLocal: false };
      } catch (error: any) {
        console.error('❌ Gemini classification failed:', error.message);
        console.log('🔄 Trying OpenAI...');
      }
    }

    // Try OpenAI second
    if (process.env.OPENAI_API_KEY) {
      try {
        const openaiLLM = new ChatOpenAI({
          modelName: 'gpt-4o-mini',
          temperature: 0.1,
          openAIApiKey: process.env.OPENAI_API_KEY,
        });
        const response = await openaiLLM.invoke(prompt);
        const classification = JSON.parse(response.content as string);
        console.log('✅ Classified using OpenAI');
        return { result: classification, usedLocal: false };
      } catch (error: any) {
        console.error('❌ OpenAI classification failed:', error.message);
        console.log('🔄 Falling back to local LLM');
      }
    }

    // Final fallback: Local LLM
    console.log('🤖 Using local LLM fallback');
    const result = await this.classifyWithLocalLLM(emailData);
    console.log("🚀 ~ EmailClassifierAgent ~ classify ~ result:", result)
    return { result, usedLocal: true };
  }

  private async classifyWithLocalLLM(emailData: EmailData) {
    try {
      const result = await classifyEmailLocal(
        emailData.subject,
        emailData.body,
        `${emailData.senderName} <${emailData.sender}>`
      );
      return result;
    } catch (error) {
      console.error('❌ Local LLM also failed, using regex fallback');
      return this.fallbackClassification(emailData);
    }
  }

  private fallbackClassification(emailData: EmailData) {
    const text = `${emailData.subject} ${emailData.body}`.toLowerCase();
    return {
      is_hierarchy: /boss|manager|director|ceo|vp|president|leadership|executive/i.test(text),
      is_client: /client|customer|vendor|partner|external/i.test(text),
      is_meeting: /meeting|meet|call|discussion|schedule|zoom|teams|conference/i.test(text),
      is_escalation: /escalation|issue|problem|concern|critical|blocker/i.test(text),
      is_urgent: /asap|urgent|immediately|deadline|critical|emergency/i.test(text),
      suggested_label: 'Uncategorized',
      reasoning: 'Fallback regex-based classification due to parsing error'
    };
  }
}

export class EmbeddingAgent {
  private embeddings: GoogleGenerativeAIEmbeddings | OllamaEmbeddings | null;
  private readonly TARGET_DIMENSIONS = 768; // Consistent 768D for Gemini and Ollama
  private embeddingSource: 'gemini' | 'ollama' = 'gemini';

  constructor() {
    // Priority: 1. Gemini (768D) → 2. Ollama (768D)
    // Note: OpenAI is skipped for embeddings (1536D incompatible with our 768D vector DB)
    if (process.env.GEMINI_API_KEY) {
      this.embeddings = new GoogleGenerativeAIEmbeddings({
        model: 'text-embedding-004',
        apiKey: process.env.GEMINI_API_KEY,
      });
      this.embeddingSource = 'gemini';
      console.log('✅ Using Gemini embeddings (768D)');
    } else {
      // Use Ollama for embeddings (compatible 768D)
      const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const ollamaModel = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
      this.embeddings = new OllamaEmbeddings({
        baseUrl: ollamaBaseUrl,
        model: ollamaModel,
      });
      this.embeddingSource = 'ollama';
      console.log('✅ Using Ollama embeddings (768D)');
    }
  }

  async generateEmbedding(text: string, forceLocal: boolean = false): Promise<{ embedding: number[], model: string }> {
    try {
      // If classification used local LLM, force local embeddings for consistency
      if (forceLocal) {
        console.log('🔄 Using local embeddings to match local classification');
        const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        const ollamaModel = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
        const ollamaEmbeddings = new OllamaEmbeddings({
          baseUrl: ollamaBaseUrl,
          model: ollamaModel,
        });
        const embedding = await ollamaEmbeddings.embedQuery(text);
        console.log(`✅ Generated ${embedding.length}D embedding with local Ollama (forced for consistency)`);
        return {
          embedding,
          model: 'ollama'
        };
      }

      // Try primary embedding service (Gemini)
      if (this.embeddings) {
        const embedding = await this.embeddings.embedQuery(text);

        if (embedding.length !== this.TARGET_DIMENSIONS) {
          console.warn(`⚠️  Expected ${this.TARGET_DIMENSIONS} dimensions, got ${embedding.length}`);
        }

        return {
          embedding,
          model: this.embeddingSource
        };
      }

      throw new Error('No embedding service configured');
    } catch (error: any) {
      console.error('❌ Primary embedding failed:', error.message);

      // Fallback to Ollama if currently using Gemini
      if (this.embeddingSource === 'gemini') {
        try {
          console.log('🔄 Falling back to Ollama embeddings...');
          const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
          const ollamaModel = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
          const ollamaEmbeddings = new OllamaEmbeddings({
            baseUrl: ollamaBaseUrl,
            model: ollamaModel,
          });
          const embedding = await ollamaEmbeddings.embedQuery(text);
          console.log(`✅ Generated ${embedding.length}D embedding with Ollama fallback`);
          return {
            embedding,
            model: 'ollama'
          };
        } catch (ollamaError: any) {
          console.error('❌ Ollama embedding fallback also failed:', ollamaError.message);
        }
      }

      throw new Error('All embedding methods failed');
    }
  }

  getEmbeddingModel(): string {
    return this.embeddingSource;
  }
}

class StorageAgent {
  async storeEmail(emailData: EmailData): Promise<number> {
    const result = await client.query(
      `INSERT INTO emails (subject, body, sender_email, sender_name, received_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        emailData.subject,
        emailData.body,
        emailData.sender,
        emailData.senderName,
        emailData.receivedAt
      ]
    );
    return result.rows[0].id;
  }

  async storeMetadata(
    emailId: number,
    labels: any,
    reasoning: string,
    embedding: number[],
    embeddingModel: string
  ): Promise<void> {
    await client.query(
      `INSERT INTO email_meta (
        email_id, is_hierarchy, is_client, is_meeting,
        is_escalation, is_urgent, classification, embedding, embedding_model
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        emailId,
        labels.is_hierarchy,
        labels.is_client,
        labels.is_meeting,
        labels.is_escalation,
        labels.is_urgent,
        JSON.stringify({ ...labels, reasoning }),
        embedding,
        embeddingModel
      ]
    );
  }
}

// Orchestrator that coordinates all agents
class EmailProcessingOrchestrator {
  private classifierAgent: EmailClassifierAgent;
  private embeddingAgent: EmbeddingAgent;
  private storageAgent: StorageAgent;

  constructor() {
    this.classifierAgent = new EmailClassifierAgent();
    this.embeddingAgent = new EmbeddingAgent();
    this.storageAgent = new StorageAgent();
  }

  async process(emailData: EmailData): Promise<ClassificationResult> {
    console.log('🤖 Multi-Agent System Processing Email...');

    // Step 1: Classifier Agent analyzes the email
    console.log('📊 Classifier Agent: Analyzing email content...');
    const { result: classification, usedLocal } = await this.classifierAgent.classify(emailData);
    console.log('✓ Classifier Agent: Classification complete', classification);

    // Step 2: Embedding Agent generates vector representation
    // If classification used local LLM, force embeddings to also use local for consistency
    console.log('🧠 Embedding Agent: Generating vector embedding...');
    const emailText = `${emailData.subject}\n\n${emailData.body}`;
    const { embedding, model: embeddingModel } = await this.embeddingAgent.generateEmbedding(emailText, usedLocal);
    console.log(`✓ Embedding Agent: Vector embedding generated using ${embeddingModel}`);

    // Step 3: Storage Agent stores email and metadata
    console.log('💾 Storage Agent: Storing email in database...');
    const emailId = await this.storageAgent.storeEmail(emailData);
    console.log(`✓ Storage Agent: Email stored with ID ${emailId}`);

    console.log('💾 Storage Agent: Storing metadata and embedding...');
    await this.storageAgent.storeMetadata(
      emailId,
      classification,
      classification.reasoning,
      embedding,
      embeddingModel
    );
    console.log(`✓ Storage Agent: Metadata and ${embeddingModel} embedding stored`);

    console.log('✅ Multi-Agent System: Processing complete!');

    return {
      emailId,
      labels: {
        is_hierarchy: classification.is_hierarchy,
        is_client: classification.is_client,
        is_meeting: classification.is_meeting,
        is_escalation: classification.is_escalation,
        is_urgent: classification.is_urgent,
      },
      reasoning: classification.reasoning
    };
  }
}

// Main export function
export async function processEmailWithLangChain(
  emailData: EmailData
): Promise<ClassificationResult> {
  const orchestrator = new EmailProcessingOrchestrator();
  return await orchestrator.process(emailData);
}
