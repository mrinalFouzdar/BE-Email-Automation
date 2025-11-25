import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { decryptPassword } from './encryption.service';

interface ImapConfig {
  host: string;
  port: number;
  username: string;
  encryptedPassword: string;
}

interface ProcessedEmail {
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  body: string;
  date: Date;
  messageId: string;
  isUnread: boolean;
}

/**
 * Extracts email addresses from an address string
 */
function extractEmails(addresses: any): string[] {
  if (!addresses) return [];

  if (Array.isArray(addresses)) {
    return addresses.map((addr) => addr.address || '').filter(Boolean);
  }

  if (typeof addresses === 'string') {
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
    return addresses.match(emailRegex) || [];
  }

  return [];
}

/**
 * Fetches emails from an IMAP server
 * @param config - IMAP connection configuration
 * @param maxEmails - Maximum number of emails to fetch (default: 50)
 * @returns Array of processed emails
 */
export async function fetchEmailsViaImap(
  config: ImapConfig,
  maxEmails: number = 50
): Promise<ProcessedEmail[]> {
  const password = decryptPassword(config.encryptedPassword);

  const imap = new Imap({
    user: config.username,
    password: password,
    host: config.host,
    port: config.port,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    connTimeout: 10000,
    authTimeout: 5000
  });

  return new Promise((resolve, reject) => {
    const emails: ProcessedEmail[] = [];
    let processedCount = 0;

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          imap.end();
          reject(new Error(`Failed to open INBOX: ${err.message}`));
          return;
        }

        const totalMessages = box.messages.total;
        if (totalMessages === 0) {
          imap.end();
          resolve([]);
          return;
        }

        // Fetch last N emails
        const start = Math.max(1, totalMessages - maxEmails + 1);
        const end = totalMessages;

        const fetch = imap.seq.fetch(`${start}:${end}`, {
          bodies: ['HEADER.FIELDS (FROM TO CC SUBJECT DATE MESSAGE-ID)', 'TEXT'],
          struct: true,
          markSeen: false
        });

        fetch.on('message', (msg, seqno) => {
          let emailData: Partial<ProcessedEmail> = {};
          let isUnread = false;

          msg.on('body', (stream, info) => {
            let buffer = '';

            stream.on('data', (chunk) => {
              buffer += chunk.toString('utf8');
            });

            stream.once('end', () => {
              simpleParser(buffer, (err, parsed: ParsedMail) => {
                if (err) {
                  console.error(`Parse error for message ${seqno}:`, err);
                  return;
                }

                emailData = {
                  subject: parsed.subject || '(No Subject)',
                  from: parsed.from?.text || parsed.from?.value?.[0]?.address || 'unknown',
                  to: extractEmails(parsed.to),
                  cc: extractEmails(parsed.cc),
                  body: parsed.text || parsed.html || '',
                  date: parsed.date || new Date(),
                  messageId: parsed.messageId || `generated-${seqno}-${Date.now()}`,
                  isUnread
                };
              });
            });
          });

          msg.once('attributes', (attrs) => {
            // Check if email is unread
            isUnread = !attrs.flags.includes('\\Seen');
          });

          msg.once('end', () => {
            processedCount++;

            if (emailData.subject) {
              emails.push(emailData as ProcessedEmail);
            }

            // If all messages processed, close connection
            if (processedCount >= (end - start + 1)) {
              imap.end();
            }
          });
        });

        fetch.once('error', (err) => {
          console.error('Fetch error:', err);
          imap.end();
          reject(new Error(`Failed to fetch emails: ${err.message}`));
        });

        fetch.once('end', () => {
          console.log(`Fetched ${emails.length} emails from IMAP`);
        });
      });
    });

    imap.once('error', (err) => {
      console.error('IMAP connection error:', err);
      reject(new Error(`IMAP connection failed: ${err.message}`));
    });

    imap.once('end', () => {
      resolve(emails);
    });

    imap.connect();
  });
}

/**
 * Tests IMAP connection without fetching emails
 * @param config - IMAP connection configuration
 * @returns True if connection successful
 */
export async function testImapConnection(config: ImapConfig): Promise<boolean> {
  const password = decryptPassword(config.encryptedPassword);

  const imap = new Imap({
    user: config.username,
    password: password,
    host: config.host,
    port: config.port,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    connTimeout: 10000,
    authTimeout: 5000
  });

  return new Promise((resolve, reject) => {
    imap.once('ready', () => {
      imap.end();
      resolve(true);
    });

    imap.once('error', (err) => {
      reject(new Error(`Connection test failed: ${err.message}`));
    });

    imap.connect();
  });
}

/**
 * Tests IMAP connection with plain password (for validation before encryption)
 * @param config - IMAP connection configuration with plain password
 * @returns Success status and error message if failed
 */
export async function testImapConnectionPlain(config: {
  host: string;
  port: number;
  username: string;
  password: string;
}): Promise<{ success: boolean; error?: string }> {
  const imap = new Imap({
    user: config.username,
    password: config.password,
    host: config.host,
    port: config.port,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    connTimeout: 10000,
    authTimeout: 5000
  });

  return new Promise((resolve) => {
    imap.once('ready', () => {
      imap.end();
      resolve({ success: true });
    });

    imap.once('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    imap.connect();
  });
}
