# Security Fix: Missing Rate Limiting on Login & Password Reset

## 1. Vulnerability Summary
- **OWASP Classification:** A07:2021 – Identification and Authentication Failures
- **CWE:** CWE-307 (Improper Restriction of Excessive Authentication Attempts)
- **Affected Components:**
  - `backend/routes/details/student-details.route.js`
  - `backend/routes/details/faculty-details.route.js`
  - `backend/routes/details/admin-details.route.js`
  - `backend/routes/auth.route.js`
  - `backend/middlewares/rateLimiter.middleware.js` (new)

---

## 2. Symptoms
- **Unlimited Password Guessing:** `POST /api/{student|faculty|admin}/login` accepted an unlimited number of attempts per second. An attacker could run a dictionary or brute-force attack against any account, and the weak default passwords (`student123`, `faculty123`) made this especially effective.
- **Inbox Flooding:** `POST /api/{role}/forget-password` could be called endlessly for the same address, sending unlimited password-reset emails to a victim's inbox and exhausting the SMTP sending quota of the college mail account.
- **Unthrottled Reset Submissions:** `POST /api/{role}/update-password/:resetId` could be called repeatedly with guessed tokens.
- **Unthrottled Google Login:** `POST /api/auth/google` had no request ceiling.

---

## 3. Root Cause
- Authentication endpoints had no throttling layer; every request went straight to the controller and database.
- No per-account or per-source counters existed anywhere in the request pipeline.

---

## 4. Architectural Solution Implemented

### Pillar 1: Centralised Rate Limiting Middleware
- Added `express-rate-limit` and a single module, `backend/middlewares/rateLimiter.middleware.js`, exporting three limiters built from one `createLimiter()` factory.
- Limiters are attached per route, so only the sensitive authentication endpoints are throttled; normal API traffic is unaffected.

| Limiter | Routes | Limit | Counter key |
|---|---|---|---|
| `loginLimiter` | `/login` (all roles), `/api/auth/google` | 5 failed attempts / 15 min | IP + email |
| `resetRequestLimiter` | `/forget-password` (all roles) | 3 requests / hour | target email |
| `resetSubmitLimiter` | `/update-password/:resetId` (all roles) | 5 attempts / 15 min | IP |

### Pillar 2: Brute Force Protection Without Collateral Lockouts
- `loginLimiter` uses `skipSuccessfulRequests: true`, so only **failed** logins count; a user who logs in correctly is never throttled.
- The counter key combines the client IP with the normalised email. One source cannot keep guessing a single account, while students sharing a campus NAT IP do not lock each other out.
- IPs are keyed through `ipKeyGenerator()`, which groups IPv6 addresses by subnet so an attacker cannot bypass the limit by rotating through a single IPv6 allocation.

### Pillar 3: Inbox Flooding Protection
- `resetRequestLimiter` is keyed on the **target email** (lower-cased and trimmed), not the caller's IP. Rotating IPs or switching the role in the URL does not reset the counter, so a victim receives at most 3 reset emails per hour.
- This works alongside the existing uniform response ("If an account with that email exists…"), so the limiter does not reveal which emails are registered.

### Pillar 4: Consistent API Responses
- Throttled requests return **HTTP 429 Too Many Requests** in the project's standard `ApiResponse` shape (`{ success: false, message, data: null }`), so the existing frontend toasts display the message without any client changes.
- Standard `RateLimit` / `RateLimit-Policy` headers (IETF draft-8) tell clients when they can retry.

---

## 5. Verification

| Test | Expected | Result |
|---|---|---|
| 3 correct admin logins | 200, not counted | 200 200 200 |
| 6 wrong passwords for one account | 401 ×5, then 429 | 401 ×5, 429 |
| Wrong password for a different account, same IP | Not blocked | 404 (normal response) |
| Same account with different email casing | Shares counter | 429 |
| 4 reset requests for one email across different roles | 200 ×3, then 429 | 200 ×3, 429 |
| 6 reset submissions | 400 ×5, then 429 | 400 ×5, 429 |
| 6 invalid Google credentials | 401 ×5, then 429 | 401 ×5, 429 |

---

## 6. Known Limitations
- Counters are held in memory (`MemoryStore`). They reset when the server restarts and are not shared between multiple server instances; a production deployment behind a load balancer should use a shared store such as Redis (`rate-limit-redis`).
- If the API is deployed behind a reverse proxy, `app.set("trust proxy", 1)` must be configured so `req.ip` is the real client IP rather than the proxy's.
- Keying reset requests on the target email means an attacker can use up a victim's 3 hourly reset requests. This is an intentional trade-off: a temporary reset delay is far less harmful than unlimited inbox flooding.

---

## 7. Software Engineering Fundamentals Applied
- **Defense in Depth:** Throttling complements the existing hashed reset tokens and generic responses rather than replacing them.
- **DRY:** One `createLimiter()` factory and one middleware module serve all three roles instead of per-controller counters.
- **Separation of Concerns:** Rate limiting lives in the routing and middleware layer; controllers stay unchanged.
- **Fail Securely:** Excess requests are rejected before any database lookup, bcrypt comparison or email is sent.
