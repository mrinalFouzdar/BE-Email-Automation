"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptPassword = encryptPassword;
exports.decryptPassword = decryptPassword;
exports.testEncryption = testEncryption;
const crypto_1 = __importDefault(require("crypto"));
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
}
// Verify key is exactly 32 bytes (64 hex characters)
const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
if (keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 hex characters)');
}
const IV_LENGTH = 16; // AES block size
/**
 * Encrypts a password using AES-256-CBC
 * @param password - Plain text password to encrypt
 * @returns Encrypted string in format: iv:encryptedText
 */
function encryptPassword(password) {
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv('aes-256-cbc', keyBuffer, iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // Return IV + encrypted data
    return iv.toString('hex') + ':' + encrypted;
}
/**
 * Decrypts a password that was encrypted with encryptPassword
 * @param encryptedPassword - Encrypted string in format: iv:encryptedText
 * @returns Decrypted plain text password
 */
function decryptPassword(encryptedPassword) {
    const parts = encryptedPassword.split(':');
    if (parts.length !== 2) {
        throw new Error('Invalid encrypted password format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto_1.default.createDecipheriv('aes-256-cbc', keyBuffer, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
/**
 * Tests encryption/decryption to ensure it's working correctly
 */
function testEncryption() {
    try {
        const testPassword = 'test_password_123';
        const encrypted = encryptPassword(testPassword);
        const decrypted = decryptPassword(encrypted);
        return decrypted === testPassword;
    }
    catch (error) {
        console.error('Encryption test failed:', error);
        return false;
    }
}
