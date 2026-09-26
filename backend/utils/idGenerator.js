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

module.exports = {
  generateSecureEnrollmentNo,
  generateSecureEmployeeId,
};
