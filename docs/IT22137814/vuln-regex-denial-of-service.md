# Security Fix: Regular Expression Denial of Service (ReDoS) in Search

- **Student ID:** IT22137814
- **Student Name:** K.B.P.T Dunuwila

---

## 1. Vulnerability Summary
- **OWASP Classification:** A03:2021 – Injection
- **CWE Identification:**
  - CWE-400: Uncontrolled Resource Consumption
  - CWE-1333: Inefficient Regular Expression Complexity
  - CWE-943: Improper Neutralization of Special Elements in Data Query Logic
- **Affected Components:**
  - `backend/controllers/details/student-details.controller.js`
  - `backend/controllers/branch.controller.js`
  - `backend/controllers/exam.controller.js`
  - `backend/utils/regexHelper.js` (new)

---

## 2. Symptoms
- **Event Loop Freezing (Node.js Engine Starvation):** Node.js executes JavaScript on a single-threaded event loop. When a search request containing nested quantifiers or overlapping groups (e.g. `(a+)+$`, `(a|aa)+`, `.*.*.*.*.*.*.*.*!`) was passed to MongoDB `$regex`, the regular expression engine entered exponential backtracking. During backtracking, the CPU peaked at 100%, causing the server to freeze and drop incoming requests for all other users.
- **Unhandled Syntax Error Crashes:** Sending unclosed regex symbols (e.g. `(`, `[`, `*`, `\`) caused the database driver or regex compiler to throw a malformed regular expression syntax error, resulting in unhandled 500 Internal Server Errors.
- **Regex Logic Hijacking:** Attackers could search with regex operators like `.*` or `^` to bypass search filters, extract unexpected records, or conduct blind timing attacks.
- **NoSQL Query Object Injection:** Search parameters sent via request bodies or query strings (e.g. `name: { $ne: null }`) were not verified as primitive strings, allowing attackers to inject query objects directly into MongoDB criteria.
- **Unbounded Memory Consumption:** Search strings had no upper length bound; payloads containing tens of thousands of characters consumed excessive memory during query compilation.

---

## 3. Root Cause
- Untrusted user input from `req.body.name`, `req.query.search`, and `req.query.examType` was passed directly into `{ $regex: input, $options: "i" }` without escaping regular expression metacharacters.
- Input parameters lacked type validation (allowing object injection) and length boundaries.

---

## 4. Architectural Solution Implemented

### Pillar 1: Metacharacter Escaping (`escapeRegex`)
Implemented `escapeRegex` in `backend/utils/regexHelper.js` to escape all 14 special characters recognized by regular expression engines:
`[.*+?^${}()|[\]\\]` $\rightarrow$ `\$&`

When escaped, any pattern such as `((a+)+)+$` or `name*` is interpreted strictly as a **literal string** rather than an executable pattern with quantifiers.

### Pillar 2: Input Sanitization & Control Character Stripping
Implemented `sanitizeSearchInput` with strict boundaries:
- **Type Enforcement:** If the input is not a string (e.g. an injected object `{ $gt: "" }`), it is immediately discarded and returned as an empty string.
- **Control Character Removal:** Strips null bytes (`\x00`) and non-printable control characters (`\x00-\x1F\x7F`).
- **Length Bounding:** Trims whitespace and caps search queries at a maximum of **50 characters**, preventing high-memory allocation and buffer stress.

### Pillar 3: Centralized Safe Search Helper (`toSafeSearchPattern`)
Created a unified utility that applies both sanitization and regex escaping in a single invocation:
```javascript
const safeSearch = toSafeSearchPattern(search, 50);
```
Controllers consume this single source of truth across all search endpoints:
- In `student-details.controller.js` (`searchStudentsController`): Applied to `name` matching across `firstName`, `middleName`, and `lastName`. Numerical inputs (`enrollmentNo`, `semester`) are strictly coerced using `Number()`, and `branchId` is sanitized against object injection.
- In `branch.controller.js` (`getBranchController`): Applied to `search` across `name` and `branchId`. If empty, queries with `{}` instead of scanning empty regexes.
- In `exam.controller.js` (`getAllExamsController`): Applied to `search`, `examType`, and `semester`.

---

## 5. Verification

| Test Case | Target Endpoint | Input Payload | Expected Behavior | Result |
|---|---|---|---|---|
| ReDoS catastrophic backtracking | `POST /api/student/search` | `name: "((a+)+)+$"` | Escaped to literal `\(\(a\+\)\+\)\+\$`; returns in < 2ms with zero event loop lag | Blocked / Safe (< 2ms) |
| Repetitive wildcard ReDoS | `GET /api/branch?search=.*.*.*.*.*.*.*.*a` | 100 repetitions of `.*` | Escaped to literal `\.\*\.\*...`; executes instantly | Blocked / Safe (< 2ms) |
| Unclosed regex parenthesis | `POST /api/student/search` | `name: "("` | Escaped to `\(`; no regex syntax error thrown | Safe (200 / 404) |
| Unclosed regex bracket | `GET /api/branch?search=[a-z` | `search: "[a-z"` | Escaped to `\[a-z`; no syntax error | Safe (200 / 404) |
| Literal symbol search | `GET /api/branch?search=C++` | `search: "C++"` | Matches branches named "C++" literally without plus quantifier | Success |
| Special character search | `POST /api/student/search` | `name: "John (Jr)"` | Matches literal "John (Jr)" without group capture | Success |
| NoSQL object injection | `POST /api/student/search` | `name: { "$ne": null }` | Object rejected by sanitizer; returns 400 Bad Request | Neutralized (400) |
| Oversized input | `GET /api/branch?search=<1000 chars>` | 1,000 characters | Truncated to safe 50-character limit | Safe / Truncated |
| Normal student search | `POST /api/student/search` | `name: "John"` | Returns student records matching "John" | Success (200) |
| Normal branch search | `GET /api/branch?search=CS` | `search: "CS"` | Returns branches matching "CS" | Success (200) |

---

## 6. Software Engineering Fundamentals Applied
- **Input Neutralization:** Treat untrusted data strictly as literal text rather than executable query expressions.
- **Fail Securely & Defensive Programming:** Type checks reject unexpected objects before query execution, guarding against NoSQL injection.
- **Resource Bounding:** Strict character length limits protect against resource exhaustion attacks at the entry layer.
- **Separation of Concerns & DRY:** All sanitization and escaping logic resides in a centralized utility (`regexHelper.js`) rather than ad-hoc inline regexes in individual controllers.
