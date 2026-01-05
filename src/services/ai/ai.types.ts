export interface ClassificationResult {
  is_hierarchy: boolean;
  is_client: boolean;
  is_meeting: boolean;
  is_escalation: boolean;
  is_urgent: boolean;
  suggested_label: string;
  reasoning: string;
}

export interface ClassificationExample {
  subject: string;
  sender: string;
  suggested_label: string;
  reasoning: string;
  similarity?: number;
}
