# Security Fix: Missing Role-Based Access Control & Object ID Tampering (IDOR)

## 1. Vulnerability Summary
- **OWASP Classification:** A01:2021 – Broken Access Control
- **CWE:** CWE-285 (Improper Authorization), CWE-639 (Authorization Bypass Through User-Controlled Key)
- **Affected Components:**
  - `backend/middlewares/auth.middleware.js`
  - `backend/middlewares/authorize.middleware.js` (new)
  - `backend/utils/roles.js` (new)
  - `backend/controllers/auth.controller.js`
  - `backend/controllers/details/student-details.controller.js`
  - `backend/controllers/details/faculty-details.controller.js`
  - `backend/controllers/details/admin-details.controller.js`
  - `backend/routes/details/student-details.route.js`
  - `backend/routes/details/faculty-details.route.js`
  - `backend/routes/details/admin-details.route.js`
  - `backend/routes/{branch,subject,notice,timetable,material,exam,marks}.route.js`

---

## 2. Symptoms
- **Students could edit other students:** `PATCH /api/student/:id` accepted any valid token. A logged-in student could change another student's name, email, semester or branch just by putting that student's ID in the URL.
- **Students could change grades:** `POST /api/marks/bulk` and `DELETE /api/marks/:id` had no role check, so a student could overwrite or delete anyone's marks.
- **Any logged-in user could perform admin actions:** admin-only operations (`GET /api/student`, `PATCH/DELETE /api/admin/:id`, branch and subject management, etc.) were protected only by "is logged in", not "is an admin".
- **Faculty could perform admin actions:** a faculty account could delete students or create and delete branches.
- **Public student/faculty registration:** `POST /api/student/register` and `POST /api/faculty/register` required no token at all.
- **Deleted or deactivated users kept access:** tokens stayed valid for up to one hour after an account was removed or set to `inactive`.

---

## 3. Root Cause
- The JWT issued at login only contained `userId`. The server had no way of knowing whether the caller was a student, faculty member or admin.
- The `auth` middleware only performed **authentication** ("who are you?"). No layer performed **authorization** ("are you allowed to do this?").
- Endpoints trusted object IDs supplied in the URL or query string (`/:id`, `?studentId=`) without checking that the caller was allowed to access that object.
- Once a token was signed, the server never checked whether the account still existed or was still active.

---

## 4. Architectural Solution Implemented

### Pillar 1: Role Claim in the Signed Token
- Every login path (`/api/{student|faculty|admin}/login` and `/api/auth/google`) now signs `{ userId, role }`.
- The token is signed with `JWT_SECRET`, so a user cannot change their own role without invalidating the signature.
- Created `backend/utils/roles.js` with a single `ROLE_MODELS` map (role → Mongoose model), shared by Google login and the auth middleware. It uses a null prototype so a value such as `"constructor"` can never resolve to a built-in object.

### Pillar 2: Live Account Verification in `auth`
- After verifying the JWT signature, `auth` looks the user up in the collection that matches their role.
- The request is rejected with **401 Unauthorized** if:
  - the account no longer exists,
  - the account `status` is not `active`, or
  - the role in the token does not match the account (for example, a student's ID with `role: "admin"`).
- Tokens issued before this fix (no `role` claim) are rejected; users log in again once.
- The verified role is exposed to later middleware as `req.userRole`.

### Pillar 3: Route-Level Authorization (`authorize(...roles)`)
- New middleware `backend/middlewares/authorize.middleware.js` returns **403 Forbidden** unless `req.userRole` is in the allowed list, e.g. `authorize("admin", "faculty")`.
- It runs **before** `multer`, so unauthorized users cannot write files to the server's disk.
- Every protected route now declares exactly which roles may use it:

| Resource | Read | Create / Update / Delete |
|---|---|---|
| Admin records (`/api/admin`) | admin | admin |
| Faculty records (`/api/faculty`) | admin | admin (incl. register) |
| Student records (`/api/student`) | admin | admin (incl. register) |
| Student search | admin, faculty | — |
| `my-details`, `change-password` | own role only | own role only |
| Marks – own (`/api/marks/student`) | student | — |
| Marks – any student | admin, faculty | admin, faculty |
| Branch, Subject | all roles | admin |
| Notice, Timetable, Exam | all roles | admin, faculty |
| Material | all roles | faculty (plus existing owner check) |

### Pillar 4: Closing the IDOR
- The only marks endpoint a student can reach (`GET /api/marks/student`) reads the student ID from the **verified token** (`req.userId`), never from the URL or query string.
- Every endpoint that accepts a student ID from the request (`/marks`, `/marks/bulk`, `/marks/:id`, `/student/:id`) is now restricted to staff roles.

---

## 5. Verification
An end-to-end script logged in as each role through the real routes, using a temporary MongoDB database. It ran the same attacks against the old code (`develop`) and against this fix.

| Test | Before (develop) | After (this fix) |
|---|---|---|
| Student A `PATCH /api/student/:B` | 200, B's name changed to "Hacked" | **403**, unchanged |
| Student overwrites B's marks via `/marks/bulk` | 200, mark 40 → 0 | **403**, unchanged |
| Student deletes a marks record | 200 | **403** |
| Student lists all students | 200 | **403** |
| Student edits an admin | 200 | **403** |
| Faculty deletes a student | 200 | **403** |
| Faculty creates a branch | 201 | **403** |
| Student posts a notice | 201 | **403** |
| Anonymous `POST /api/student/register` | reaches controller | **401** |
| Token without `role` claim | 200 | **401** |
| Role claim signed with the wrong secret | 401 | **401** |
| Validly signed token with wrong role for the account | 200 | **401** |
| Deactivated student's live token | 200 | **401** |

Legitimate flows still work after the fix:

| Test | Result |
|---|---|
| Student reads own details / own marks / branches | 200 |
| Faculty loads marks sheet and submits marks | 200 |
| Faculty searches students and posts a notice | 200 / 201 |
| Admin edits a student (incl. emergency contact) | 200 |

---

## 6. Known Limitations
- `POST /api/admin/register` is still public. It is tracked separately as Vulnerability 1 (Public Admin Registration, `fix/admin-creation-and-crypto`).
- The account lookup in `auth` adds one indexed `findById` query per request. This is an intentional trade-off so that deleted and deactivated accounts lose access immediately instead of after the token expires.
- Faculty can submit marks for any student or subject. Restricting faculty to the subjects they teach would need a faculty–subject assignment model, which the system does not have yet.
- All existing sessions are logged out once after deployment, because old tokens have no `role` claim.

---

## 7. Software Engineering Fundamentals Applied
- **Least Privilege / Deny by Default:** every write route names the roles allowed to use it; everyone else receives 403.
- **Never Trust Client-Supplied Identity:** a student's own data is looked up using the ID inside the signed token, never an ID from the URL.
- **Defense in Depth:** signed role claim + live account check + per-route role check, so one failing layer does not expose the system.
- **DRY / Single Source of Truth:** one `ROLE_MODELS` map and one `authorize()` factory serve all roles and routes.
- **Separation of Concerns:** who may call an endpoint is declared in the routing layer; controllers stay focused on business logic.
