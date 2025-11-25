import crypto from 'crypto';

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
export function encryptPassword(password: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);

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
export function decryptPassword(encryptedPassword: string): string {
  const parts = encryptedPassword.split(':');

  if (parts.length !== 2) {
    throw new Error('Invalid encrypted password format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];

  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Tests encryption/decryption to ensure it's working correctly
 */
export function testEncryption(): boolean {
  try {
    const testPassword = 'test_password_123';
    const encrypted = encryptPassword(testPassword);
    const decrypted = decryptPassword(encrypted);
    return decrypted === testPassword;
  } catch (error) {
    console.error('Encryption test failed:', error);
    return false;
  }
}
