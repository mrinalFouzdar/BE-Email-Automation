import { ImapFlow, MailboxLockObject, ImapFlowOptions } from "imapflow";
import { simpleParser, ParsedMail } from "mailparser";
import { listAccounts, updateLastSync } from "./modules/accounts/account.service";
import { decryptPassword } from "./services/encryption.service";
import { detectImapConfig } from "./utils/imap-config";
import { EmailAccount } from "./modules/accounts/account.model";
import { classifyEmail } from "./services/classifier.service";

/**
 * Process unread emails for a single account using IMAP.
 */
export async function processEmailsForAccount(account: EmailAccount): Promise<void> {
    console.log("🚀 ~ processEmailsForAccount ~ account:", account)
    // Only process accounts that have auto_fetch enabled
    if (!account.auto_fetch) return;

    // Resolve IMAP connection settings
    let host = account.imap_host;
    let port = account.imap_port || 993;
    let secure = true;

    if (!host && account.email) {
        const detected = detectImapConfig(account.email);
        if (detected) {
            host = detected.host;
            port = detected.port;
            secure = detected.secure;
        }
    }

    if (!host) {
        console.warn(`Skipping account ${account.email} — no IMAP host configured`);
        return;
    }

    const username = account.imap_username || account.email;
    let password: string | undefined;
    if (account.imap_password_encrypted) {
        try {
            password = decryptPassword(account.imap_password_encrypted);
        } catch (err) {
            console.error(`Failed to decrypt password for ${account.email}:`, err);
            return;
        }
    }

    if (!password) {
        console.warn(`Skipping account ${account.email} — no IMAP password available`);
        return;
    }

    const config: ImapFlowOptions = {
        host,
        port,
        secure,
        auth: {
            user: username,
            pass: password
        }
    };
    console.log("🚀 ~ processEmailsForAccount ~ config:", config)

    const client = new ImapFlow(config);
    let lock: MailboxLockObject | null = null;

    try {
        await client.connect();

        lock = await client.getMailboxLock("INBOX");

        const unreadMsgIds = await client.search({ seen: false });
        if (!unreadMsgIds || unreadMsgIds.length === 0) {
            console.log(`No unread emails for ${account.email}`);
            await updateLastSync(account.id);
            return;
        }

    } finally {
        if (lock) lock.release();
        try {
            await client.logout();
        } catch (e) {
            // ignore logout errors
        }
    }
}

/**
 * Process emails for all configured accounts (reads accounts from DB)
 */
export async function processAllAccounts(): Promise<void> {
    try {
        const accounts = await listAccounts();
        for (const acct of accounts) {
            // Only IMAP-style accounts are handled here (provider_type === 'imap')
            if (acct.provider_type === 'imap' && acct.status === 'connected') {
                // Fire-and-forget per account, but await to avoid too many simultaneous connections
                await processEmailsForAccount(acct);
            } else if (acct.provider_type === 'gmail' && acct.imap_password_encrypted) {
                // Some Gmail entries may store IMAP password (app password) — handle similarly
                await processEmailsForAccount(acct);
            } else {
                // Skip accounts without IMAP credentials (Gmail OAuth-only accounts need a different flow)
                console.log(`Skipping non-IMAP account or not ready: ${acct.email} (${acct.provider_type})`);
            }
        }
    } catch (err) {
        console.error('Failed to load accounts for email processing:', err);
    }
}

export default processAllAccounts;