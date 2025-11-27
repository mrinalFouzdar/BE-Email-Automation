export interface ClassificationResult {
  is_hierarchy: boolean;
  is_client: boolean;
  is_meeting: boolean;
  is_escalation: boolean;
  is_urgent: boolean;
  suggested_label?: string;
  reasoning: string;
}

export interface EmailData {
  subject: string;
  body: string;
  sender: string;
  senderName: string;
  receivedAt: string;
}

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
}

export interface SimilaritySearchResult {
  id: number;
  subject: string;
  body: string;
  distance: number;
  similarity?: number;
}
