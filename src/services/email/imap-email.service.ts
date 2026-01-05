import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { convert } from 'html-to-text';
import { decryptPassword } from '../encryption.service.js';

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
  imapUid: number;
  imapMailbox: string;
  isUnread: boolean;
  attachments?: Array<{
    filename: string;
    contentType: string;
    content: Buffer;
  }>;
}

/**
 * Normalizes Message-ID to ensure it has angle brackets
 * Gmail stores Message-IDs with angle brackets, but parsers may strip them
 */
function normalizeMessageId(messageId: string): string {
  if (!messageId) return messageId;

  // Remove any existing angle brackets first
  let normalized = messageId.trim();
  if (normalized.startsWith('<')) {
    normalized = normalized.substring(1);
  }
  if (normalized.endsWith('>')) {
    normalized = normalized.substring(0, normalized.length - 1);
  }

  // Add angle brackets
  return `<${normalized}>`;
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
 * @param maxEmails - Maximum number of emails to fetch (optional - if not provided, fetches ALL emails)
 * @returns Array of processed emails
 */
export async function fetchEmailsViaImap(
  config: ImapConfig,
  maxEmails?: number
): Promise<ProcessedEmail[]> {
  const password = decryptPassword(config.encryptedPassword);

  const imap = new Imap({
    user: config.username,
    password: password,
    host: config.host,
    port: config.port,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    connTimeout: 30000,  // Increased to 30 seconds
    authTimeout: 20000   // Increased to 20 seconds
  });

                  
            
                  
  return new Promise((resolve, reject) => {
    const emails: ProcessedEmail[] = [];
    let processedCount = 0;

    imap.once('ready', () => {
      const mailboxName = 'INBOX'; // Store mailbox name for UID context
      imap.openBox(mailboxName, true, (err, box) => {
        if (err) {
          imap.end();
          reject(new Error(`Failed to open ${mailboxName}: ${err.message}`));
          return;
        }

        const totalMessages = box.messages.total;
        if (totalMessages === 0) {
          imap.end();
          resolve([]);
          return;
        }

        // Fetch the LATEST emails (newest first)
        // IMAP sequence: 1 = oldest, totalMessages = newest
        // If maxEmails not provided or >= total, fetch all emails
        // Otherwise fetch latest N emails: from (totalMessages - N + 1) to totalMessages
        const shouldFetchAll = !maxEmails || maxEmails >= totalMessages;
        // console.log("🚀 ~ fetchEmailsViaImap ~ shouldFetchAll:", shouldFetchAll)
        const start = shouldFetchAll ? 1 : Math.max(1, totalMessages - maxEmails + 1);
        // console.log("🚀 ~ fetchEmailsViaImap ~ start:", start)
        const end = totalMessages;
        // console.log("🚀 ~ fetchEmailsViaImap ~ end:", end)

        // console.log(`📥 Fetching ${shouldFetchAll ? 'ALL' : 'latest ' + maxEmails} emails (${start} to ${end} of ${totalMessages} total)...`);

        const fetch = imap.seq.fetch(`${start}:${end}`, {
          bodies: '',
          struct: true,
          markSeen: false
        });

        fetch.on('message', (msg, seqno) => {
          let emailData: Partial<ProcessedEmail> = {};
          let isUnread = false;
          let imapUid: number = 0;
          let parsingComplete = false;
          let attributesComplete = false;

          // Function to push email only when both parsing and attributes are done
          const tryPushEmail = () => {
            if (parsingComplete && attributesComplete && emailData.subject) {
              if (isUnread) {
                emails.push(emailData as ProcessedEmail);
                console.log("✅ Unread email stored:", emails.length, "total")
              } else {
                console.log("⊙ Skipping read email:", emailData.subject?.substring(0, 50))
              }
            }
          };

          msg.on('body', (stream, info) => {
            let buffer = '';

            stream.on('data', (chunk) => {
              buffer += chunk.toString('utf8');
            });

            stream.once('end', () => {
              simpleParser(buffer, (err, parsed: ParsedMail) => {
                if (err) {
                  console.error(`Parse error for message ${seqno}:`, err);
                  parsingComplete = true;
                  return;
                }

                // console.log("🚀 ~ fetchEmailsViaImap ~ parsed.subject:", parsed.subject)
                // console.log("🚀 ~ fetchEmailsViaImap ~ parsed.to:", parsed.to)
                const toEmails = extractEmails(parsed.from);
                // if(toEmails.includes('fouzdarmrinal4@gmail.com')){
                //   console.log("🚀 ~ fetchEmailsViaImap ~ parsed.to.text:-----", parsed.from)
                // }

                const fromAddress = parsed.from?.text || parsed.from?.value?.[0]?.address || 'unknown';
                const emailDate = parsed.date || new Date();
                console.log(`📧 Email from: ${fromAddress} | subject: ${parsed.subject} | Time: ${emailDate}`);

                // Extract PDF attachments
                const pdfAttachments: Array<{filename: string; contentType: string; content: Buffer}> = [];
                if (parsed.attachments && parsed.attachments.length > 0) {
                  for (const attachment of parsed.attachments) {
                    if (attachment.contentType === 'application/pdf' || attachment.filename?.toLowerCase().endsWith('.pdf')) {
                      pdfAttachments.push({
                        filename: attachment.filename || 'unknown.pdf',
                        contentType: attachment.contentType || 'application/pdf',
                        content: attachment.content
                      });
                      console.log(`📎 Found PDF attachment: ${attachment.filename}`);
                    }
                  }
                }

                console.log("🚀 ~ fetchEmailsViaImap ~ parsed.text:", parsed.text)
                console.log("🚀 ~ fetchEmailsViaImap ~ parsed.html:", parsed.html)

                // Use text from HTML if plain text is missing or contains "Enable Javascript" placeholder
                const textBody = parsed.text || '';
                const htmlBody = parsed.html || '';
                let finalBody = textBody;

                // Check for invalid plain text content
                const isInvalidText = !textBody || 
                                      textBody.includes('Please Enable Javascript') || 
                                      textBody.includes('Enable JavaScript') ||
                                      (textBody.length < 50 && htmlBody.length > 200);

                if (isInvalidText && htmlBody) {
                  console.log('🔄 Converting HTML to Text (Plain text was invalid/missing)...');
                  finalBody = convert(htmlBody, {
                    wordwrap: false, // Don't enforce line breaks, let the UI handle wrapping
                    selectors: [
                      { selector: 'img', format: 'skip' },
                      { selector: 'a', options: { hideLinkHrefIfSameAsText: true } }
                    ]
                  });
                }

                // Clean up excessive whitespace and newlines (allow max 2 newlines for paragraphs)
                finalBody = finalBody
                  .replace(/(\r\n|\r|\n){3,}/g, '\n\n') // Collapse 3+ newlines to 2
                  .trim();

                emailData = {
                  subject: parsed.subject || '(No Subject)',
                  from: fromAddress,
                  to: extractEmails(parsed.to),
                  cc: extractEmails(parsed.cc),
                  body: finalBody,
                  date: emailDate,
                  messageId: normalizeMessageId(parsed.messageId || `generated-${seqno}-${Date.now()}`),
                  imapUid,
                  imapMailbox: mailboxName,
                  isUnread,
                  attachments: pdfAttachments.length > 0 ? pdfAttachments : undefined
                };
                console.log("🚀 ~ fetchEmailsViaImap ~ emailData:", emailData)
                console.log("🚀 ~ fetchEmailsViaImap ~ parsed.messageId:", parsed.messageId)

                parsingComplete = true;
                tryPushEmail(); // Try to push if attributes are also ready
              });
            });
          });

          msg.once('attributes', (attrs) => {
            // Check if email is unread
            isUnread = !attrs.flags.includes('\\Seen');
            // Capture IMAP UID for future label operations
            imapUid = attrs.uid;
            console.log("🚀 ~ fetchEmailsViaImap ~ from:", emailData.from, "| isUnread:", isUnread, "| imapUid:", imapUid)
            attributesComplete = true;
            tryPushEmail(); // Try to push if parsing is also complete
          });

          msg.once('end', () => {
            processedCount++;
            // Email is pushed via tryPushEmail() after both parsing and attributes complete
            // console.log("🚀 ~ fetchEmailsViaImap ~ emails:", emails.length)

            // Log progress every 50 emails
            // if (processedCount % 50 === 0) {
            //   console.log(`   → Processed ${processedCount}/${end - start + 1} emails...`);
            // }

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
          // console.log(`Fetched ${emails.length} emails from IMAP`);
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
    connTimeout: 30000,  // Increased to 30 seconds
    authTimeout: 20000   // Increased to 20 seconds
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
