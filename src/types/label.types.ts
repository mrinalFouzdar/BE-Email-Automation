export interface Label {
  id: number;
  name: string;
  color: string;
  description?: string;
  is_system: boolean;
  created_by_user_id?: number;
  created_at: Date;
}

export interface EmailLabel {
  id: number;
  email_id: number;
  label_id: number;
  assigned_by: 'ai' | 'user' | 'admin' | 'system';
  confidence_score?: number;
  created_at: Date;
}

export interface LabelCreateInput {
  name: string;
  color?: string;
  description?: string;
  is_system?: boolean;
  created_by_user_id?: number;
}

export interface LabelAssignmentInput {
  email_id: number;
  label_id: number;
  assigned_by: 'ai' | 'user' | 'admin' | 'system';
  confidence_score?: number;
}

export interface PendingLabelSuggestion {
  id: number;
  email_id: number;
  user_id: number;
  suggested_label_name: string;
  suggested_by: 'ai' | 'system' | 'similarity' | 'hybrid';
  confidence_score?: number;
  reasoning?: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: number;
  approved_at?: Date;
  created_at: Date;
}

export interface PendingLabelSuggestionCreateInput {
  email_id: number;
  user_id: number;
  suggested_label_name: string;
  suggested_by?: 'ai' | 'system' | 'similarity' | 'hybrid';
  confidence_score?: number;
  reasoning?: string;
}

export interface PendingLabelApprovalInput {
  suggestion_id: number;
  action: 'approve' | 'reject';
  approved_by: number;  // User or admin ID
}
