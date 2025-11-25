export type EmailRow = {
  id: number;
  gmail_id: string;
  thread_id?: string;
  subject: string;
  sender_email: string;
  to_recipients: string[];
  cc_recipients: string[];
  recipients: string[];
  body: string;
  is_unread: boolean;
  labels: string[];
  received_at: string;
  created_at: string;
  account_id?: number;
};
