import { google } from 'googleapis';
import { decryptPassword } from '../encryption.service.js';

interface GmailAccount {
  oauth_client_id: string;
  oauth_client_secret_encrypted: string;
  oauth_refresh_token_encrypted: string;
}

/**
 * Creates a Gmail API client with OAuth credentials
 */
function createGmailClient(account: GmailAccount) {
  const clientId = account.oauth_client_id;
  const clientSecret = decryptPassword(account.oauth_client_secret_encrypted);
  const refreshToken = decryptPassword(account.oauth_refresh_token_encrypted);

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    process.env.GMAIL_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Ensures a label exists in Gmail, creates it if not
 * @param gmail - Gmail API client
 * @param labelName - Label name to ensure exists
 * @returns Label ID
 */
async function ensureLabelExists(gmail: any, labelName: string): Promise<string> {
  try {
    // List existing labels
    const response = await gmail.users.labels.list({ userId: 'me' });
    const labels = response.data.labels || [];

    // Check if label already exists
    const existingLabel = labels.find(
      (l: any) => l.name?.toLowerCase() === labelName.toLowerCase()
    );

    if (existingLabel) {
      return existingLabel.id;
    }

    // Create new label
    const createResponse = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: labelName,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show'
      }
    });

    console.log(`✓ Created Gmail label: ${labelName}`);
    return createResponse.data.id;
  } catch (error: any) {
    console.error(`Error ensuring label "${labelName}":`, error.message);
    throw new Error(`Failed to ensure label: ${error.message}`);
  }
}

/**
 * Sets labels on a Gmail message
 * @param account - Gmail account credentials
 * @param gmailId - Gmail message ID
 * @param labelsToAdd - Array of label names to add
 * @param labelsToRemove - Array of label names to remove (optional)
 * @returns Success status
 */
export async function setGmailLabels(
  account: GmailAccount,
  gmailId: string,
  labelsToAdd: string[],
  labelsToRemove: string[] = []
): Promise<{ success: boolean; error?: string }> {
  try {
    const gmail = createGmailClient(account);

    // Get label IDs for labels to add
    const addLabelIds: string[] = [];
    for (const labelName of labelsToAdd) {
      const labelId = await ensureLabelExists(gmail, labelName);
      addLabelIds.push(labelId);
    }

    // Get label IDs for labels to remove
    const removeLabelIds: string[] = [];
    if (labelsToRemove.length > 0) {
      const response = await gmail.users.labels.list({ userId: 'me' });
      const allLabels = response.data.labels || [];

      for (const labelName of labelsToRemove) {
        const label = allLabels.find(
          (l: any) => l.name?.toLowerCase() === labelName.toLowerCase()
        );
        if (label) {
          removeLabelIds.push(label.id);
        }
      }
    }

    // Modify message labels
    await gmail.users.messages.modify({
      userId: 'me',
      id: gmailId,
      requestBody: {
        addLabelIds: addLabelIds,
        removeLabelIds: removeLabelIds
      }
    });

    console.log(`✓ Updated labels for Gmail message ${gmailId}`);
    return { success: true };
  } catch (error: any) {
    console.error(`Error setting Gmail labels:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Sets a single label on multiple Gmail messages (batch operation)
 * @param account - Gmail account credentials
 * @param gmailIds - Array of Gmail message IDs
 * @param labelName - Label name to add
 * @returns Results for each message
 */
export async function batchSetGmailLabel(
  account: GmailAccount,
  gmailIds: string[],
  labelName: string
): Promise<Array<{ gmailId: string; success: boolean; error?: string }>> {
  const results = [];

  for (const gmailId of gmailIds) {
    const result = await setGmailLabels(account, gmailId, [labelName]);
    results.push({
      gmailId,
      success: result.success,
      error: result.error
    });
  }

  return results;
}

/**
 * Syncs AI-generated labels from database to Gmail mailbox
 * @param account - Gmail account credentials
 * @param gmailId - Gmail message ID
 * @param aiGeneratedLabels - Labels suggested by AI
 * @returns Success status
 */
export async function syncAILabelsToGmail(
  account: GmailAccount,
  gmailId: string,
  aiGeneratedLabels: string[]
): Promise<{ success: boolean; error?: string }> {
  if (!aiGeneratedLabels || aiGeneratedLabels.length === 0) {
    return { success: true }; // Nothing to sync
  }

  // Add AI prefix to distinguish AI-generated labels
  const labeledNames = aiGeneratedLabels.map(label => `AI/${label}`);

  return setGmailLabels(account, gmailId, labeledNames);
}
