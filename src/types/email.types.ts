export interface Email {
  id: number;
  gmail_id?: string;
  thread_id?: string;
  sender_email: string;
  sender_name?: string;
  to_recipients?: string[];
  cc_recipients?: string[];
  recipients?: string[];
  subject: string;
  body: string;
  is_unread: boolean;
  labels?: string[];
  received_at: Date;
  created_at: Date;
  account_id?: number;
}

export interface EmailMeta {
  id: number;
  email_id: number;
  is_hierarchy: boolean;
  is_client: boolean;
  is_meeting: boolean;
  is_escalation: boolean;
  is_urgent: boolean;
  is_mom: boolean;
  has_mom_received?: boolean;
  related_meeting_id?: number;
  classification?: Record<string, any>;
  embedding?: number[];
  suggested_label?: string;
  label_confidence?: number;
  created_at: Date;
}

export interface EmailCreateInput {
  gmail_id?: string;
  thread_id?: string;
  sender_email: string;
  sender_name?: string;
  subject: string;
  body: string;
  to_recipients?: string[];
  cc_recipients?: string[];
  account_id?: number;
}

export interface EmailFilters {
  is_unread?: boolean;
  labels?: string[];
  sender?: string;
  search?: string;
  from_date?: Date;
  to_date?: Date;
  userId?: number;
}
