const crypto = require("crypto");

/**
 * Cryptographically Secure ID Generator
 * Replaces insecure Math.random() with Node.js CSPRNG (crypto.randomInt).
 * Compliant with OWASP A02:2021 (Cryptographic Failures) and CWE-338.
 */

/**
 * Generates a cryptographically secure 6-digit student enrollment number (100000 - 999999).
 * Uses operating system entropy via crypto.randomInt to prevent mathematical prediction.
 * @returns {number} 6-digit secure integer
 */
const generateSecureEnrollmentNo = () => {
  return crypto.randomInt(100000, 1000000);
};

/**
 * Generates a cryptographically secure 6-digit employee ID (100000 - 999999).
 * Uses operating system entropy via crypto.randomInt to prevent mathematical prediction.
 * @returns {number} 6-digit secure integer
 */
const generateSecureEmployeeId = () => {
  return crypto.randomInt(100000, 1000000);
};

/**
 * Generates a high-entropy 64-character hex password reset token and its SHA-256 hash.
 * Compliant with OWASP Forgot Password Cheat Sheet (Hash-at-Rest).
 * @returns {{ rawToken: string, tokenHash: string }}
 */
const generateResetToken = () => {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
};

/**
 * Computes SHA-256 hash of a submitted token string for database comparison.
 * @param {string} token
 * @returns {string}
 */
const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

module.exports = {
  generateSecureEnrollmentNo,
  generateSecureEmployeeId,
  generateResetToken,
  hashToken,
};
