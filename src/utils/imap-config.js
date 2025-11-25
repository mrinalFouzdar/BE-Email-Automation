"use strict";
/**
 * IMAP Auto-detection for common email providers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectImapConfig = detectImapConfig;
exports.getSupportedProviders = getSupportedProviders;
exports.isProviderSupported = isProviderSupported;
// Common IMAP configurations for popular providers
const IMAP_CONFIGS = {
    // Gmail
    'gmail.com': {
        host: 'imap.gmail.com',
        port: 993,
        secure: true
    },
    // Outlook/Hotmail/Live
    'outlook.com': {
        host: 'outlook.office365.com',
        port: 993,
        secure: true
    },
    'hotmail.com': {
        host: 'outlook.office365.com',
        port: 993,
        secure: true
    },
    'live.com': {
        host: 'outlook.office365.com',
        port: 993,
        secure: true
    },
    // Yahoo
    'yahoo.com': {
        host: 'imap.mail.yahoo.com',
        port: 993,
        secure: true
    },
    'yahoo.co.uk': {
        host: 'imap.mail.yahoo.com',
        port: 993,
        secure: true
    },
    'yahoo.co.in': {
        host: 'imap.mail.yahoo.com',
        port: 993,
        secure: true
    },
    // ProtonMail (Bridge required)
    'protonmail.com': {
        host: '127.0.0.1', // ProtonMail Bridge runs locally
        port: 1143,
        secure: true
    },
    'proton.me': {
        host: '127.0.0.1',
        port: 1143,
        secure: true
    },
    // iCloud
    'icloud.com': {
        host: 'imap.mail.me.com',
        port: 993,
        secure: true
    },
    'me.com': {
        host: 'imap.mail.me.com',
        port: 993,
        secure: true
    },
    // AOL
    'aol.com': {
        host: 'imap.aol.com',
        port: 993,
        secure: true
    },
    // Zoho
    'zoho.com': {
        host: 'imap.zoho.com',
        port: 993,
        secure: true
    },
    'zohomail.com': {
        host: 'imap.zoho.com',
        port: 993,
        secure: true
    }
};
/**
 * Auto-detect IMAP configuration from email address
 * @param email - User's email address
 * @returns IMAP configuration or null if unknown provider
 */
function detectImapConfig(email) {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) {
        return null;
    }
    return IMAP_CONFIGS[domain] || null;
}
/**
 * Get list of supported providers for UI dropdown
 */
function getSupportedProviders() {
    return Object.keys(IMAP_CONFIGS);
}
/**
 * Check if provider is supported
 */
function isProviderSupported(email) {
    return detectImapConfig(email) !== null;
}
