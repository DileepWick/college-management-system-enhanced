# Security Fix: Unrestricted File Upload in Multer

- **Student ID:** IT22137814
- **Student Name:** K.B.P.T Dunuwila

---

## 1. Vulnerability Summary
- **OWASP Classification:** A04:2021 – Insecure Design
- **CWE Identification:**
  - CWE-434: Unrestricted Upload of File with Dangerous Type
  - CWE-400: Uncontrolled Resource Consumption (Resource Exhaustion / DoS)
- **Affected Components:**
  - `backend/middlewares/multer.middleware.js`
  - `backend/routes/details/student-details.route.js`
  - `backend/routes/details/faculty-details.route.js`
  - `backend/routes/details/admin-details.route.js`
  - `backend/routes/material.route.js`
  - `backend/routes/timetable.route.js`
  - `backend/routes/exam.route.js`
  - `backend/routes/marks.route.js`
  - `backend/index.js`

---

## 2. Symptoms
- **Acceptance of Arbitrary & Executable Files:** The original Multer disk storage setup accepted any file extension and MIME type. Attackers could upload executable binaries (`.exe`, `.bin`), shell scripts (`.sh`, `.bat`), server-side scripts (`.php`), or client-side web vectors (`.html`, `.svg` containing embedded `<script>` payloads) into `./media`.
- **Denial of Service via Disk Exhaustion:** No `limits: { fileSize: ... }` was configured on upload requests. Malicious actors could upload arbitrary multi-gigabyte files to overwhelm the host server filesystem, resulting in service denial for the institution.
- **Predictable Filenames & Race Condition Collisions:** Uploaded files were named using `Date.now() + path.extname(file.originalname)`. Because millisecond timestamps are predictable, an attacker could anticipate file URLs or cause filename overwrite collisions under concurrent requests. Moreover, user-supplied extensions were directly appended without sanitization.
- **Unhandled Crashes on Upload Errors:** Multer rejection errors (such as exceeding limits or stream errors) lacked structured error handling, causing Express to return unhandled 500 error pages instead of uniform JSON API responses.

---

## 3. Root Cause
- The Multer instance was initialized with default configuration without defining a `fileFilter` callback to restrict allowed MIME types or file extensions.
- Storage limits were omitted, permitting unlimited payload sizes.
- A single generic uploader was used across all routes, failing to differentiate between profile photos, academic documents, and timetables.

---

## 4. Architectural Solution Implemented

### Pillar 1: Context-Specific MIME & Extension Whitelists
Instead of a single unconstrained upload handler, the system now provides domain-specific uploader instances configured through a centralized factory in `backend/middlewares/multer.middleware.js`:

| Uploader | Allowed Routes | Allowed Extensions | Allowed MIME Types | File Size Limit |
|---|---|---|---|---|
| `uploadImage` | `/api/{student\|faculty\|admin}/register`, `/:id` | `.jpg`, `.jpeg`, `.png`, `.webp` | `image/jpeg`, `image/png`, `image/webp` | **2 MB** |
| `uploadDocument` | `/api/material` | `.pdf`, `.doc`, `.docx`, `.ppt`, `.pptx`, `.txt`, `.zip`, `.jpg`, `.jpeg`, `.png` | Standard office document, text, zip, and image MIME types | **10 MB** |
| `uploadSchedule` | `/api/timetable`, `/api/exam` | `.pdf`, `.jpg`, `.jpeg`, `.png` | `application/pdf`, `image/jpeg`, `image/png` | **5 MB** |

The `fileFilter` performs dual verification: it requires **both** the file extension and the client-supplied MIME type to match the approved whitelist for that context. Dangerous file formats (such as `.exe`, `.sh`, `.php`, `.js`, `.html`, `.svg`) are rejected immediately.

### Pillar 2: Cryptographically Secure Filename Generation
- Replaced predictable `Date.now()` with `crypto.randomUUID()` (128 bits of operating system entropy).
- File extensions are converted to lowercase and strictly sanitized to prevent path traversal or double-extension tricks (e.g. `exploit.php.jpg`).
- The storage destination path is resolved safely via `path.join(__dirname, "../media")`, with automated directory creation if `./media` does not exist.

### Pillar 3: Resource Quotas & File Count Enforcement
- Enforced strict payload size caps per domain context (2MB for avatars, 5MB for timetables/exams, 10MB for study materials).
- Restricted `files: 1` to prevent multiple unintended files from being buffered or written in a single field.

### Pillar 4: Consistent JSON API Responses & Error Handling
- Each uploader's `.single()` method intercepts `multer.MulterError` (e.g., `LIMIT_FILE_SIZE`, `LIMIT_UNEXPECTED_FILE`) and custom validation rejections.
- Rejected uploads immediately return **HTTP 400 Bad Request** using the standard project `ApiResponse.badRequest(...)` schema (`{ success: false, message, data: null }`).
- A centralized fallback error handler was added to `backend/index.js` as an additional layer of defense to catch any unhandled upload exceptions.

---

## 5. Verification

| Test Case | Upload Target | Input Payload | Expected Response | Result |
|---|---|---|---|---|
| Executable upload | Profile (`POST /api/student/register`) | `payload.exe` (MIME: `application/x-msdownload`) | 400 Bad Request ("Invalid file type") | Blocked (400) |
| Script file upload | Study Material (`POST /api/material`) | `shell.sh` (MIME: `application/x-sh`) | 400 Bad Request ("Invalid file type") | Blocked (400) |
| Web script injection | Profile (`POST /api/faculty/register`) | `xss.html` or `vector.svg` | 400 Bad Request ("Invalid file type") | Blocked (400) |
| Mismatched extension | Timetable (`POST /api/timetable`) | `document.pdf` with MIME `application/x-php` | 400 Bad Request ("Invalid file type") | Blocked (400) |
| Oversized avatar | Admin Profile (`POST /api/admin/register`) | 5 MB `.jpg` image (limit 2 MB) | 400 Bad Request ("File size exceeds limit of 2MB") | Blocked (400) |
| Oversized material | Study Material (`POST /api/material`) | 15 MB `.pdf` document (limit 10 MB) | 400 Bad Request ("File size exceeds limit of 10MB") | Blocked (400) |
| Valid avatar upload | Student Profile (`POST /api/student/register`) | 500 KB `.png` image | 201 Created, stored as `<uuid>.png` | Success (201) |
| Valid study material | Study Material (`POST /api/material`) | 3 MB `.pdf` document | 200 OK, stored as `<uuid>.pdf` | Success (200) |
| Valid timetable file | Timetable (`POST /api/timetable`) | 1.5 MB `.pdf` timetable | 200 OK, stored as `<uuid>.pdf` | Success (200) |

---

## 6. Software Engineering Fundamentals Applied
- **Least Privilege:** Each endpoint is restricted only to the file formats and sizes strictly necessary for its domain (e.g. profile endpoints cannot receive zip files or PDF documents).
- **Defense in Depth:** Dual-check verification of extensions and MIME types, backed by `crypto.randomUUID()` file isolation and Express security headers (media CSP).
- **Fail Securely:** Any unexpected, oversized, or unapproved file triggers an immediate abort before controller execution or database entry creation.
- **Separation of Concerns:** Upload validation and sanitization are completely encapsulated in the middleware layer; controllers receive clean, verified `req.file` metadata.
