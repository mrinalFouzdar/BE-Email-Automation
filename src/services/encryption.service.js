"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptPassword = encryptPassword;
exports.decryptPassword = decryptPassword;
exports.testEncryption = testEncryption;
var crypto = require("crypto");
var dotenv = require("dotenv");
dotenv.config();
var ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
console.log('ENCRYPTION_KEY', ENCRYPTION_KEY);
if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is required');
}
// Verify key is exactly 32 bytes (64 hex characters)
var keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
if (keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 hex characters)');
}
var IV_LENGTH = 16; // AES block size
/**
 * Encrypts a password using AES-256-CBC
 * @param password - Plain text password to encrypt
 * @returns Encrypted string in format: iv:encryptedText
 */
function encryptPassword(password) {
    var iv = crypto.randomBytes(IV_LENGTH);
    var cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
    var encrypted = cipher.update(password, 'utf8', 'hex');
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
    var parts = encryptedPassword.split(':');
    if (parts.length !== 2) {
        throw new Error('Invalid encrypted password format');
    }
    var iv = Buffer.from(parts[0], 'hex');
    var encryptedText = parts[1];
    var decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
    var decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
/**
 * Tests encryption/decryption to ensure it's working correctly
 */
function testEncryption() {
    try {
        var testPassword = 'test_password_123';
        var encrypted = encryptPassword(testPassword);
        var decrypted = decryptPassword(encrypted);
        return decrypted === testPassword;
    }
    catch (error) {
        console.error('Encryption test failed:', error);
        return false;
    }
}
