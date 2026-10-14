# Security Fix: Missing HTTP Security Headers

## 1. Vulnerability Summary
- **OWASP Classification:** A05:2021 – Security Misconfiguration
- **CWE:** CWE-693 (Protection Mechanism Failure)
  - Related: CWE-1021 (Improper Restriction of Rendered UI Layers or Frames – Clickjacking)
- **Affected Components:**
  - `backend/index.js`
  - `frontend/src/setupProxy.js` (new)

---

## 2. Symptoms
- **Clickjacking:** Neither the React frontend nor the Express API sent `X-Frame-Options` or a `Content-Security-Policy` `frame-ancestors` directive. Any external website could load the College Management System inside an invisible `<iframe>` and trick a logged-in admin into clicking hidden buttons (e.g. "Delete Student").
- **MIME Sniffing:** Without `X-Content-Type-Options: nosniff`, browsers could guess the type of files served from `/media` and execute an uploaded file as HTML or script.
- **No Content Security Policy:** Uploaded files in `/media` were served with no restrictions, so a malicious uploaded HTML/SVG file could run scripts under the API's origin.
- **Technology Fingerprinting:** Every response carried `X-Powered-By: Express`, advertising the server framework to attackers.
- **No HSTS / Referrer Policy:** Browsers were not told to enforce HTTPS, and full URLs could leak to third-party sites via the `Referer` header.

---

## 3. Root Cause
- The Express server was created with only `cors()` and `express.json()`; no security header middleware was configured.
- The frontend dev server serves pages with framework defaults, which include no anti-framing headers.
- Browser-side protections are opt-in: they are only enabled when the server explicitly sends the corresponding headers.

---

## 4. Architectural Solution Implemented

### Pillar 1: Helmet on the API (`backend/index.js`)
- Added `helmet` as the first middleware, so every API response carries the security headers:

| Header | Value | Protects against |
|---|---|---|
| `X-Frame-Options` | `DENY` | Clickjacking (legacy browsers) |
| `Content-Security-Policy` | helmet defaults + `frame-ancestors 'none'` | Clickjacking, script injection |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Protocol downgrade (active once served over HTTPS) |
| `Referrer-Policy` | `no-referrer` | URL leakage |
| `Cross-Origin-Opener-Policy` | `same-origin` | Cross-window attacks |
| `X-Powered-By` | removed | Fingerprinting |

- Helmet's defaults (`SAMEORIGIN`, `frame-ancestors 'self'`) were tightened to deny all framing, since the API never needs to be embedded.
- `Cross-Origin-Resource-Policy` is set to `cross-origin` because the frontend (a different origin) loads profile images from `/media` with `<img>`; the default `same-origin` would break them.

### Pillar 2: Locked-Down Policy for Uploaded Files (`/media`)
- Uploaded files are untrusted user content, so `/media` gets its own strict CSP:
  `default-src 'none'; img-src 'self'; media-src 'self'; object-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'`
- No scripts, fonts, forms or external connections can run from an uploaded file, even if a malicious HTML/SVG file is uploaded.
- `object-src 'self'` keeps the browser's built-in PDF viewer working for study materials and timetables opened in a new tab.

### Pillar 3: Anti-Framing Headers on the Frontend (`frontend/src/setupProxy.js`)
- The login page and dashboards are served by the React dev server, not Express, so API headers alone cannot stop the UI being framed.
- `setupProxy.js` is loaded automatically by `react-scripts` and adds these headers to every page:

| Header | Value | Reason |
|---|---|---|
| `X-Frame-Options` | `DENY` | Clickjacking |
| `Content-Security-Policy` | `frame-ancestors 'none'` | Clickjacking (modern standard) |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits URL leakage while still sending the origin that Google Sign-In requires |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` | Window isolation that still allows the Google Sign-In popup to return the credential |

- The frontend CSP is limited to `frame-ancestors` on purpose: a full script policy would break the dev server's hot reload and Google Sign-In, which loads scripts and frames from `accounts.google.com`.

---

## 5. Verification

| Test | Expected | Result |
|---|---|---|
| `curl -I http://localhost:4000/api/branch` | Helmet headers present, `X-Frame-Options: DENY`, `frame-ancestors 'none'` | Present |
| `curl -I http://localhost:4000/` | No `X-Powered-By` header | Removed |
| `curl -I http://localhost:4000/media/<file>` | Strict media CSP, `X-Frame-Options: DENY`, `Cross-Origin-Resource-Policy: cross-origin` | Present |
| `curl -I http://localhost:3000/` and deep links (`/student`) | `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, COOP | Present |
| Admin login from the frontend origin | 200, token returned | Works |
| Frontend dev server | Compiles | Compiled successfully |

**Manual clickjacking check:** save the following as `attack.html` and open it in a browser. The frame must stay blank and the console shows *"Refused to display … in a frame because it set 'X-Frame-Options' to 'deny'"*.

```html
<iframe src="http://localhost:3000" width="800" height="600"></iframe>
```

---

## 6. Deployment Notes
- `setupProxy.js` only runs on the development server (`npm run dev` / `npm start`). A production build (`npm run build`) is served by whatever host is used (Nginx, Netlify, Vercel, etc.), which **must send the same headers**. For example, in Nginx:
  ```nginx
  add_header X-Frame-Options "DENY" always;
  add_header Content-Security-Policy "frame-ancestors 'none'" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Cross-Origin-Opener-Policy "same-origin-allow-popups" always;
  ```
- HSTS only takes effect once the API is served over HTTPS; browsers ignore it on plain `http://localhost`.

---

## 7. Software Engineering Fundamentals Applied
- **Secure by Default:** Protections are applied globally as the first middleware rather than per route, so new endpoints are covered automatically.
- **Defense in Depth:** Both the legacy header (`X-Frame-Options`) and the modern standard (`frame-ancestors`) are sent, on both the API and the UI.
- **Least Privilege:** Uploaded content receives the most restrictive policy that still lets it display.
- **Minimise Information Disclosure:** Server fingerprinting headers are removed.
