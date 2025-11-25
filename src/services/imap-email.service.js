"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchEmailsViaImap = fetchEmailsViaImap;
exports.testImapConnection = testImapConnection;
exports.testImapConnectionPlain = testImapConnectionPlain;
const imap_1 = __importDefault(require("imap"));
const mailparser_1 = require("mailparser");
const encryption_service_1 = require("./encryption.service");
/**
 * Extracts email addresses from an address string
 */
function extractEmails(addresses) {
    if (!addresses)
        return [];
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
async function fetchEmailsViaImap(config, maxEmails = 50) {
    const password = (0, encryption_service_1.decryptPassword)(config.encryptedPassword);
    const imap = new imap_1.default({
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
        const emails = [];
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
                    let emailData = {};
                    let isUnread = false;
                    msg.on('body', (stream, info) => {
                        let buffer = '';
                        stream.on('data', (chunk) => {
                            buffer += chunk.toString('utf8');
                        });
                        stream.once('end', () => {
                            (0, mailparser_1.simpleParser)(buffer, (err, parsed) => {
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
                            emails.push(emailData);
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
async function testImapConnection(config) {
    const password = (0, encryption_service_1.decryptPassword)(config.encryptedPassword);
    const imap = new imap_1.default({
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
async function testImapConnectionPlain(config) {
    const imap = new imap_1.default({
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
