const crypto = require('crypto');

/**
 * Symmetric encryption helper for storing secrets at rest in the database.
 *
 * Uses AES-256-GCM with a 256-bit key derived from `JWT_SECRET` via SHA-256.
 * Reusing JWT_SECRET keeps the operator from having to rotate two secrets,
 * but you can override with COOKIE_ENCRYPTION_KEY if you ever want to scope
 * the keys separately. JWT_SECRET is already required to be at least 32
 * characters (see src/web/auth.js), so we always have plenty of entropy.
 *
 * Storage format (single string):
 *   v1.<base64-iv>.<base64-tag>.<base64-cipher>
 *
 * The `v1` prefix lets us migrate to a different cipher / KDF without
 * breaking already-stored values; old rows decrypt with the v1 path.
 */

const ALG = 'aes-256-gcm';
const VERSION = 'v1';

function getKey() {
  const secret =
    process.env.COOKIE_ENCRYPTION_KEY ||
    process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET (or COOKIE_ENCRYPTION_KEY) must be set to use the secrets helper'
    );
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a UTF-8 string. Returns the v1 string form.
 */
function encryptString(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  if (typeof plaintext !== 'string') {
    throw new TypeError('encryptString requires a string');
  }
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64')
  ].join('.');
}

/**
 * Decrypt a v1 string back to UTF-8. Returns null for null/empty input.
 * Throws if the input has been tampered with or the key is wrong.
 */
function decryptString(encoded) {
  if (encoded === null || encoded === undefined || encoded === '') return null;
  if (typeof encoded !== 'string') {
    throw new TypeError('decryptString requires a string');
  }
  const parts = encoded.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Invalid encrypted secret format');
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');
  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);
  return plaintext.toString('utf8');
}

/**
 * Mask a string to its first/last few characters for logging/UI.
 *   "abcdefghijklmno" → "abc•••mno"
 */
function maskSecret(value, prefix = 4, suffix = 4) {
  if (!value || typeof value !== 'string') return '';
  if (value.length <= prefix + suffix) return '•'.repeat(value.length);
  return `${value.slice(0, prefix)}${'•'.repeat(3)}${value.slice(-suffix)}`;
}

module.exports = {
  encryptString,
  decryptString,
  maskSecret
};
