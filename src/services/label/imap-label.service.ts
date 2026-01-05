import { ImapFlow } from 'imapflow';
import { decryptPassword } from '../encryption.service.js';

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
  // console.log("🚀 ~ createImapClient ~ password:", password)

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
 * Sets a label/flag on an IMAP email by IMAP UID or Message-ID
 * For Gmail IMAP: Creates custom label (X-GM-LABELS)
 * For other IMAP: Sets keyword flag
 * @param account - IMAP account credentials
 * @param messageId - Email Message-ID header (used as fallback if imapUid not provided)
 * @param label - Label to add (e.g., "Work", "Important", "AI/Invoice")
 * @param imapUid - Optional IMAP UID for direct access (faster and more reliable)
 * @param imapMailbox - Optional mailbox name where UID is valid (CRITICAL: UID only works in its original mailbox!)
 * @returns Success status
 */
export async function setImapLabel(
  account: ImapAccount,
  messageId: string,
  label: string,
  imapUid?: number,
  imapMailbox?: string
): Promise<{ success: boolean; error?: string; method?: string }> {
  let client: ImapFlow | null = null;

  try {
    client = await createImapClient(account);

    // Check if this is Gmail IMAP (supports X-GM-LABELS)
    const isGmail = account.imap_host.includes('gmail');

    // CRITICAL: Use the mailbox where UID was captured, NOT a default mailbox
    // UIDs are only valid within their original mailbox!
    let searchMailbox: string;

    if (imapUid && imapMailbox) {
      // Use the stored mailbox where this UID is valid
      searchMailbox = imapMailbox;
      console.log(`✓ Using stored mailbox: ${searchMailbox} (UID context preserved)`);
    } else {
      // Fallback for old emails without mailbox info
      searchMailbox = isGmail ? '[Gmail]/All Mail' : 'INBOX';
      console.log(`⚠️  No mailbox info, using default: ${searchMailbox}`);
    }

    try {
      await client.mailboxOpen(searchMailbox);
    } catch (mailboxError: any) {
      // If stored mailbox doesn't exist, fallback to INBOX
      console.log(`Mailbox ${searchMailbox} not found, falling back to INBOX`);
      await client.mailboxOpen('INBOX');
    }

    let uid: number;

    // Use IMAP UID directly if provided (faster and more reliable)
    if (imapUid) {
      uid = imapUid;
      console.log(`✓ Using provided IMAP UID: ${uid}`);
    } else {
      // Fallback: Search for message by Message-ID
      console.log(`🔍 Searching for Message-ID: ${messageId}`);
      const searchResults = await client.search({
        header: { 'message-id': messageId }
      });

      console.log(`🔍 Search results: Found ${searchResults?.length || 0} matches`);

      if (!searchResults || searchResults.length === 0) {
        await client.logout();
        console.error(`❌ Message not found. Message-ID: ${messageId}`);
        return { success: false, error: `Message not found in ${searchMailbox}` };
      }

      if (searchResults.length > 1) {
        console.warn(`⚠️  Multiple messages found for Message-ID: ${messageId}. Using first result.`);
      }

      uid = searchResults[0];
      console.log(`✓ Found message UID: ${uid} for Message-ID: ${messageId}`);
    }

    // Verify we have the correct message by fetching its envelope
    try {
      const messageData = await client.fetchOne(uid, {
        envelope: true,
        uid: true
      });

      if (messageData && messageData.envelope) {
        console.log(`✓ Verified message - Subject: "${messageData.envelope.subject}"`);
        console.log(`  From: ${messageData.envelope.from?.[0]?.address || 'unknown'}`);
      }
    } catch (verifyError: any) {
      console.warn(`⚠️  Could not verify message: ${verifyError.message}`);
    }

    if (isGmail) {
      // Gmail IMAP: Labels are treated as mailboxes/folders
      // To add a label, we COPY the message to the label mailbox
      try {
        const gmailLabel = label;

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
        console.log(`📋 Copying message UID ${uid} to label "${gmailLabel}"...`);
        await client.messageCopy(uid, gmailLabel, { uid: true });

        console.log(`✓ Added Gmail label "${gmailLabel}" to message ${messageId}`);
        await client.logout();
        return { success: true, method: 'gmail-copy' };
      } catch (error: any) {
        console.warn(`Gmail COPY method failed: ${error.message}`);
        // Fallback: Try using keyword flags (less reliable for Gmail UI)
        try {
          const prefixedLabel = label;
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
      // Other IMAP servers (Outlook, etc.): Create folders and copy emails
      try {
        // 1. Check if folder exists
        let folderExists = false;
        try {
          const list = await client.list();
          folderExists = list.some((box: any) => box.path === label);
        } catch (e) {
          folderExists = false;
        }

        // 2. Create folder if it doesn't exist
        if (!folderExists) {
          try {
            await client.mailboxCreate(label);
            console.log(`  ✓ Created IMAP folder: ${label}`);
          } catch (createError: any) {
            // Folder might already exist, continue
            console.log(`  → IMAP folder may already exist: ${label}`);
          }
        }

        // 3. Copy the message to the folder (this creates a labeled copy)
        await client.messageCopy(uid, label, { uid: true });
        console.log(`✓ Copied email to folder "${label}"`);

        // 4. Also flag important emails for visibility
        const importantLabels = ['urgent', 'escalation', 'priority', 'critical'];
        const isImportant = importantLabels.some(imp =>
          label.toLowerCase().includes(imp)
        );

        if (isImportant) {
          await client.messageFlagsAdd(uid, ['\\Flagged'], { uid: true });
          console.log(`✓ Flagged message as important`);
        }

        await client.logout();
        return { success: true, method: 'folder-copy' };
      } catch (error: any) {
        // Fallback: Try keyword flags if folder creation fails
        try {
          await client.messageFlagsAdd(uid, [label], { uid: true });
          console.log(`✓ Added keyword "${label}" to message ${messageId}`);
          await client.logout();
          return { success: true, method: 'keyword' };
        } catch (keywordError: any) {
          // Final fallback: Flag important emails
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
              error: 'Folders and keywords not supported, used \\Flagged flag instead'
            };
          }

          await client.logout();
          return {
            success: false,
            error: 'IMAP server does not support folders, keywords, or custom labels'
          };
        }
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
 * @param imapUid - Optional IMAP UID for direct access
 * @param imapMailbox - Optional mailbox name where UID is valid
 * @returns Success status
 */
export async function setImapLabels(
  account: ImapAccount,
  messageId: string,
  labels: string[],
  imapUid?: number,
  imapMailbox?: string
): Promise<{ success: boolean; errors?: string[] }> {
  const errors: string[] = [];

  for (const label of labels) {
    const result = await setImapLabel(account, messageId, label, imapUid, imapMailbox);
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
 * @param imapUid - Optional IMAP UID for direct access (recommended for better performance)
 * @param imapMailbox - Optional mailbox name where UID is valid (CRITICAL for correct label assignment!)
 * @returns Success status
 */
export async function syncAILabelToImap(
  account: ImapAccount,
  messageId: string,
  aiLabel: string,
  imapUid?: number,
  imapMailbox?: string
): Promise<{ success: boolean; error?: string }> {
  if (!aiLabel || aiLabel === 'Uncategorized') {
    return { success: true }; // Skip uncategorized labels
  }

  // Use label as-is without prefix
  const labelWithPrefix = aiLabel;

  return setImapLabel(account, messageId, labelWithPrefix, imapUid, imapMailbox);
}

/**
 * Initialize default system labels in Gmail/Outlook mailbox
 * Creates Escalation, Urgent, and MOM labels/folders
 * @param account - IMAP account credentials
 * @returns Success status with created labels
 */
export async function initializeSystemLabelsInMailbox(
  account: ImapAccount
): Promise<{ success: boolean; created: string[]; errors?: string[] }> {
  let client: ImapFlow | null = null;
  const created: string[] = [];
  const errors: string[] = [];
  
  const systemLabels = ['Escalation', 'Urgent', 'MOM'];

  try {
    client = await createImapClient(account);
    
    // Check if this is Gmail
    const isGmail = account.imap_host.includes('gmail');
    
    for (const labelName of systemLabels) {
      try {
        // Check if label/folder already exists
        let labelExists = false;
        try {
          const list = await client.list();
          labelExists = list.some((box: any) => box.path === labelName);
        } catch (e) {
          labelExists = false;
        }

        // Create the label/folder if it doesn't exist
        if (!labelExists) {
          await client.mailboxCreate(labelName);
          created.push(labelName);
          console.log(`✓ Created ${isGmail ? 'Gmail label' : 'IMAP folder'}: ${labelName}`);
        } else {
          console.log(`→ ${isGmail ? 'Gmail label' : 'IMAP folder'} already exists: ${labelName}`);
        }
      } catch (error: any) {
        console.warn(`Failed to create ${labelName}: ${error.message}`);
        errors.push(`${labelName}: ${error.message}`);
      }
    }

    await client.logout();
    
    return {
      success: errors.length === 0,
      created,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error: any) {
    if (client) {
      try {
        await client.logout();
      } catch (e) {
        // Ignore logout errors
      }
    }
    console.error('Error initializing system labels in mailbox:', error.message);
    return {
      success: false,
      created,
      errors: [error.message]
    };
  }
}

