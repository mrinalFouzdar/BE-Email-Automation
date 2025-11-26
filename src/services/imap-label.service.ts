import { ImapFlow } from 'imapflow';
import { decryptPassword } from './encryption.service';

interface ImapAccount {
  imap_host: string;
  imap_port: number;
  imap_username: string;
  imap_password_encrypted: string;
}

/**
 * Creates an ImapFlow client connection
 */
async function createImapClient(account: ImapAccount): Promise<ImapFlow> {
  const password = decryptPassword(account.imap_password_encrypted);

  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: true,
    auth: {
      user: account.imap_username,
      pass: password
    },
    logger: false
  });

  await client.connect();
  return client;
}

/**
 * Sets a label/flag on an IMAP email by Message-ID
 * For Gmail IMAP: Creates custom label (X-GM-LABELS)
 * For other IMAP: Sets keyword flag
 * @param account - IMAP account credentials
 * @param messageId - Email Message-ID header
 * @param label - Label to add (e.g., "Work", "Important", "AI/Invoice")
 * @returns Success status
 */
export async function setImapLabel(
  account: ImapAccount,
  messageId: string,
  label: string
): Promise<{ success: boolean; error?: string; method?: string }> {
  let client: ImapFlow | null = null;

  try {
    client = await createImapClient(account);

    // Open INBOX mailbox
    await client.mailboxOpen('INBOX');

    // Search for message by Message-ID
    const searchResults = await client.search({
      header: { 'message-id': messageId }
    });

    if (!searchResults || searchResults.length === 0) {
      await client.logout();
      return { success: false, error: 'Message not found in INBOX' };
    }

    const uid = searchResults[0];

    // Check if this is Gmail IMAP (supports X-GM-LABELS)
    const isGmail = account.imap_host.includes('gmail');

    if (isGmail) {
      // Gmail IMAP: Labels are treated as mailboxes/folders
      // To add a label, we COPY the message to the label mailbox
      try {
        const gmailLabel = label.startsWith('AI/') ? label : `AI/${label}`;

        // Ensure the Gmail label/mailbox exists
        // List all mailboxes to check if label exists
        let labelExists = false;
        try {
          const list = await client.list();
          labelExists = list.some((box: any) => box.path === gmailLabel);
        } catch (e) {
          // If list fails, assume label doesn't exist
          labelExists = false;
        }

        // Create the mailbox/label if it doesn't exist
        if (!labelExists) {
          try {
            await client.mailboxCreate(gmailLabel);
            console.log(`  ✓ Created Gmail label/mailbox: ${gmailLabel}`);
          } catch (createError: any) {
            // Label might already exist, continue
            console.log(`  → Gmail label may already exist: ${gmailLabel}`);
          }
        }

        // Copy the message to the label mailbox (this adds the label)
        await client.messageCopy(uid, gmailLabel, { uid: true });

        console.log(`✓ Added Gmail label "${gmailLabel}" to message ${messageId}`);
        await client.logout();
        return { success: true, method: 'gmail-copy' };
      } catch (error: any) {
        console.warn(`Gmail COPY method failed: ${error.message}`);
        // Fallback: Try using keyword flags (less reliable for Gmail UI)
        try {
          const prefixedLabel = label.startsWith('AI/') ? label : `AI/${label}`;
          await client.messageFlagsAdd(uid, [prefixedLabel], { uid: true });
          console.log(`✓ Added keyword "${prefixedLabel}" to message ${messageId}`);
          await client.logout();
          return { success: true, method: 'keyword' };
        } catch (keywordError: any) {
          await client.logout();
          return { success: false, error: keywordError.message };
        }
      }
    } else {
      // Other IMAP servers: Use keyword flags
      try {
        await client.messageFlagsAdd(uid, [label], { uid: true });
        console.log(`✓ Added keyword "${label}" to message ${messageId}`);
        await client.logout();
        return { success: true, method: 'keyword' };
      } catch (error: any) {
        // If keywords not supported, set standard flags for important emails
        const importantLabels = ['urgent', 'important', 'priority', 'critical', 'escalation'];
        const isImportant = importantLabels.some(imp =>
          label.toLowerCase().includes(imp)
        );

        if (isImportant) {
          await client.messageFlagsAdd(uid, ['\\Flagged'], { uid: true });
          console.log(`✓ Flagged message ${messageId} as important`);
          await client.logout();
          return {
            success: true,
            method: 'flag',
            error: 'Keywords not supported, used \\Flagged flag instead'
          };
        }

        await client.logout();
        return {
          success: false,
          error: 'IMAP server does not support custom keywords/labels'
        };
      }
    }
  } catch (error: any) {
    if (client) {
      try {
        await client.logout();
      } catch (e) {
        // Ignore logout errors
      }
    }
    console.error(`Error setting IMAP label:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Sets multiple labels on an IMAP email
 * @param account - IMAP account credentials
 * @param messageId - Email Message-ID header
 * @param labels - Array of labels to add
 * @returns Success status
 */
export async function setImapLabels(
  account: ImapAccount,
  messageId: string,
  labels: string[]
): Promise<{ success: boolean; errors?: string[] }> {
  const errors: string[] = [];

  for (const label of labels) {
    const result = await setImapLabel(account, messageId, label);
    if (!result.success && result.error) {
      errors.push(`${label}: ${result.error}`);
    }
  }

  return {
    success: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Syncs AI-generated label to IMAP mailbox
 * @param account - IMAP account credentials
 * @param messageId - Email Message-ID
 * @param aiLabel - Label suggested by AI (e.g., "Invoice", "Meeting", "Support")
 * @returns Success status
 */
export async function syncAILabelToImap(
  account: ImapAccount,
  messageId: string,
  aiLabel: string
): Promise<{ success: boolean; error?: string }> {
  if (!aiLabel || aiLabel === 'Uncategorized') {
    return { success: true }; // Skip uncategorized labels
  }

  // Add "AI/" prefix to distinguish AI-generated labels
  const labelWithPrefix = `AI/${aiLabel}`;

  return setImapLabel(account, messageId, labelWithPrefix);
}
