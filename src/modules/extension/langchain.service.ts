import { ChatOpenAI } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { client } from '../../config/db';
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
class EmailClassifierAgent {
  private llm: ChatOpenAI;

  constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  async classify(emailData: EmailData) {
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

Respond with ONLY valid JSON in this exact format:
{
  "is_hierarchy": true/false,
  "is_client": true/false,
  "is_meeting": true/false,
  "is_escalation": true/false,
  "is_urgent": true/false,
  "reasoning": "Brief explanation of classification decisions"
}`;

    const response = await this.llm.invoke(prompt);
    const content = response.content as string;

    try {
      const classification = JSON.parse(content);
      return classification;
    } catch (error) {
      console.error('Failed to parse classification JSON:', error);
      // Fallback classification
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
      reasoning: 'Fallback regex-based classification due to parsing error'
    };
  }
}

class EmbeddingAgent {
  private embeddings: OpenAIEmbeddings;

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small',
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const embedding = await this.embeddings.embedQuery(text);
      return embedding;
    } catch (error) {
      console.error('Embedding generation failed:', error);
      throw new Error('Failed to generate embedding');
    }
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
    embedding: number[]
  ): Promise<void> {
    await client.query(
      `INSERT INTO email_meta (
        email_id, is_hierarchy, is_client, is_meeting,
        is_escalation, is_urgent, classification, embedding
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        emailId,
        labels.is_hierarchy,
        labels.is_client,
        labels.is_meeting,
        labels.is_escalation,
        labels.is_urgent,
        JSON.stringify({ ...labels, reasoning }),
        embedding
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
    const classification = await this.classifierAgent.classify(emailData);
    console.log('✓ Classifier Agent: Classification complete', classification);

    // Step 2: Embedding Agent generates vector representation
    console.log('🧠 Embedding Agent: Generating vector embedding...');
    const emailText = `${emailData.subject}\n\n${emailData.body}`;
    const embedding = await this.embeddingAgent.generateEmbedding(emailText);
    console.log('✓ Embedding Agent: Vector embedding generated');

    // Step 3: Storage Agent stores email and metadata
    console.log('💾 Storage Agent: Storing email in database...');
    const emailId = await this.storageAgent.storeEmail(emailData);
    console.log(`✓ Storage Agent: Email stored with ID ${emailId}`);

    console.log('💾 Storage Agent: Storing metadata and embedding...');
    await this.storageAgent.storeMetadata(
      emailId,
      classification,
      classification.reasoning,
      embedding
    );
    console.log('✓ Storage Agent: Metadata and vector stored');

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
