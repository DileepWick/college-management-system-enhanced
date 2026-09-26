# Security Fix: Insecure Password Reset & Account Recovery Mechanism

## 1. Vulnerability Summary
- **OWASP Classification:** A07:2021 – Identification and Authentication Failures
- **CWE Identification:**
  - CWE-640: Weak Password Recovery Mechanism for Forgotten Password
  - CWE-204: Observable Response Discrepancy (User Enumeration)
  - CWE-521: Weak Password Requirements
- **Affected Components:**
  - `backend/models/reset-password.model.js`
  - `backend/controllers/details/student-details.controller.js`
  - `backend/controllers/details/faculty-details.controller.js`
  - `backend/controllers/details/admin-details.controller.js`
  - `backend/utils/idGenerator.js`

---

## 2. Symptoms
- **Exposing Internal Database IDs:** The reset link sent to users' emails contained the MongoDB document `_id` (`resetId._id`) instead of a secret cryptographic token. Because MongoDB ObjectIds contain a 4-byte timestamp, they are predictable.
- **Authentication by Pointer Reference:** When resetting a password, the client only submitted the database record ID. The server looked up the token itself; the user never proved possession of any secret token.
- **Plaintext Secret Storage:** Reset tokens were stored as plaintext strings in MongoDB, exposing all active reset tokens if database reads or backups were compromised.
- **User Enumeration:** Requesting a password reset for an unregistered email returned `404: "No Student Found"`, allowing attackers to harvest valid campus email addresses.
- **Missing Password Policy:** The password reset handler did not enforce any minimum length or complexity, permitting 1-character or empty passwords.
- **Unhandled Crashes on Expired Links:** When a reset token expired, `jwt.verify()` threw an unhandled exception, causing the server to return `500 Internal Server Error` instead of a user-friendly error response.

---

## 3. Root Cause
- Flawed account recovery workflow: Authenticating by database pointer reference rather than requiring proof-of-possession of an out-of-band secret token.
- Absence of token hashing at rest (storing plaintext secrets in database).
- Information leakage in authentication API responses.
- Complete omission of password length/strength checks during password reset operations.

---

## 4. Architectural Solution Implemented

### Pillar 1: Cryptographic High-Entropy Bearer Tokens
- Implemented `generateResetToken()` in `backend/utils/idGenerator.js` using `crypto.randomBytes(32).toString('hex')` (256 bits of operating system entropy).
- The raw, unguessable token is emailed exclusively to the user's registered inbox.

### Pillar 2: Hash-at-Rest Storage & Automated TTL Expiration
- The server never stores the raw token. Only a one-way **SHA-256 hash** (`tokenHash`) is saved in MongoDB.
- Updated `backend/models/reset-password.model.js` to index `tokenHash` and added a native MongoDB **TTL (Time-To-Live) index** on `expiresAt` (`expires: 0`), automatically purging expired tokens at the database layer after 10 minutes.
- When the user submits the reset form, the server hashes the submitted token with SHA-256 and queries `findOne({ tokenHash, expiresAt: { $gt: new Date() } })`.

### Pillar 3: Single-Use Enforcement (Burn-on-Use)
- Immediately upon a successful password update, all reset tokens for that user are permanently purged from the database, preventing replay attacks.

### Pillar 4: User Enumeration Prevention & Password Policy
- In `sendForgetPasswordEmail`, the endpoint returns a uniform, generic message: *"If an account with that email exists, a password reset link has been sent."*
- Enforced a minimum password length of 8 characters in `updatePasswordHandler`.

---

## 5. Software Engineering Fundamentals Applied
- **Compromise Containment:** Sensitive temporary credentials (like reset tokens) must be hashed at rest. If the database leaks, attackers cannot weaponize the hashes.
- **Proof of Possession:** Access control decisions must require the client to present the secret, rather than referencing an internal server record.
- **Information Hiding:** Error responses must never expose internal system states (e.g. user existence in database).
- **Defense in Depth:** Application-layer single-use deletion combined with database-layer TTL index cleanup.
