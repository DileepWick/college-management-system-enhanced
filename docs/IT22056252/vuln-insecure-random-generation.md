# Security Fix: Insecure Random Number Generation

## 1. Vulnerability Summary
- **OWASP Classification:** A02:2021 – Cryptographic Failures
- **CWE:** CWE-338 (Use of Cryptographically Weak Pseudo-Random Number Generator)
- **Affected Components:**
  - `backend/controllers/details/student-details.controller.js`
  - `backend/controllers/details/faculty-details.controller.js`
  - `backend/controllers/details/admin-details.controller.js`
  - `backend/models/details/student-details.model.js`
  - `backend/models/details/faculty-details.model.js`
  - `backend/models/details/admin-details.model.js`

---

## 2. Symptoms
- Student enrollment numbers and faculty/admin employee IDs were generated using `Math.random()`.
- **Predictability:** In V8/Node.js, `Math.random()` relies on the deterministic `xorshift128+` algorithm. An attacker observing consecutive IDs could calculate the internal generator state and predict past and future IDs.
- **Collision Risk:** With a 6-digit range, the Birthday Paradox creates a ~50% probability of ID collision after only ~1,200 registrations. Because database schemas lacked `unique` constraints, duplicate accounts could overwrite or corrupt user records.

---

## 3. Root Cause
- Insecure use of a non-cryptographic pseudo-random number generator (PRNG) for security-sensitive user identifiers.
- Violation of DRY (Don't Repeat Yourself): The generation formula was copy-pasted across three separate controller files instead of being abstracted into a single service.
- Missing database index constraints (`unique: true`) on primary business identification fields.

---

## 4. Architectural Solution Implemented

### Pillar 1: Cryptographically Secure Hardware Entropy (CSPRNG)
- Replaced `Math.random()` with Node.js built-in `crypto.randomInt(100000, 1000000)`.
- This draws true operating system entropy (kernel randomness), making generated numbers mathematically unguessable.

### Pillar 2: Centralized Identity Service (Single Source of Truth)
- Created `backend/utils/idGenerator.js` with:
  - `generateSecureEnrollmentNo()`
  - `generateSecureEmployeeId()`
- Refactored `student-details.controller.js`, `faculty-details.controller.js`, and `admin-details.controller.js` to import and consume this single source of truth.

### Pillar 3: Database Defense in Depth
- Added `unique: true` index constraint to `studentDetailsSchema.enrollmentNo`, `facultyDetailsSchema.employeeId`, and `adminDetailsSchema.employeeId`.
- Prevents race conditions and duplicate ID writes at the database layer.

---

## 5. Software Engineering Fundamentals Applied
- **Cryptographic Hygiene:** Never use standard PRNGs for security-sensitive values; always use a CSPRNG.
- **Separation of Concerns & DRY:** HTTP controllers manage request/response flow; identifier generation logic is isolated in a reusable domain utility.
- **Defense in Depth:** Cryptographic application logic is backed by database-level unique constraints.
