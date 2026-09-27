/**
 * Regular Expression & Search Sanitization Helper
 * Neutralizes Regular Expression Denial of Service (ReDoS) and NoSQL query injection.
 * Compliant with OWASP A03:2021 (Injection) and CWE-400 / CWE-943.
 */

/**
 * Escapes all regular expression metacharacters in a string so that it can be
 * safely used in a RegExp constructor or MongoDB $regex query as literal text.
 *
 * Metacharacters escaped: . * + ? ^ $ { } ( ) | [ ] \
 *
 * @param {string} str - Raw input string to escape
 * @returns {string} - Escaped string safe for literal matching
 */
const escapeRegex = (str) => {
  if (typeof str !== "string") {
    return "";
  }
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Validates, strips control characters, trims, and truncates search query inputs
 * to prevent catastrophic backtracking, high memory consumption, and NoSQL injection.
 *
 * @param {*} input - User-provided input (string, object, etc.)
 * @param {number} [maxLength=50] - Maximum allowed length for search input
 * @returns {string} - Clean, sanitized string safe for further query construction
 */
const sanitizeSearchInput = (input, maxLength = 50) => {
  if (typeof input !== "string") {
    return "";
  }

  // Strip null bytes and non-printable ASCII control characters (\x00-\x1F, \x7F)
  const stripped = input.replace(/[\x00-\x1F\x7F]/g, "");

  // Trim leading/trailing whitespace and enforce maximum character length bound
  return stripped.trim().slice(0, maxLength);
};

/**
 * Convenience helper that sanitizes and escapes an untrusted search string,
 * returning a safe literal pattern for MongoDB $regex queries.
 *
 * @param {*} input - Untrusted user input
 * @param {number} [maxLength=50] - Maximum allowed length
 * @returns {string} - Sanitized, escaped literal search pattern
 */
const toSafeSearchPattern = (input, maxLength = 50) => {
  const sanitized = sanitizeSearchInput(input, maxLength);
  return escapeRegex(sanitized);
};

module.exports = {
  escapeRegex,
  sanitizeSearchInput,
  toSafeSearchPattern,
};
