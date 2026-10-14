// Loaded automatically by the react-scripts dev server (not bundled into the app).
// Adds security headers to every page it serves. A production host must send
// the same headers (see docs/IT22077356/vuln-missing-security-headers.md).

// Backend origin (API calls and /media images), e.g. http://localhost:4000
const apiOrigin = new URL(process.env.REACT_APP_APILINK || "http://localhost:4000").origin;

// Google Sign-In endpoints, as listed in Google's CSP guidance for GIS
const GSI = "https://accounts.google.com/gsi/";

const buildCsp = (host) =>
  [
    "default-src 'self'",
    `script-src 'self' ${GSI}client`,
    // 'unsafe-inline' is needed for styles: the dev server and react-hot-toast
    // inject <style> tags. Scripts stay strict, which is what blocks XSS.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com ${GSI}style`,
    "font-src 'self' https://fonts.gstatic.com",
    `img-src 'self' data: ${apiOrigin} https://images.unsplash.com`,
    // ws:// is the dev server's live-reload socket
    `connect-src 'self' ${apiOrigin} ${GSI} ws://${host}`,
    `frame-src ${GSI}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Clickjacking: the app may never be shown inside a frame
    "frame-ancestors 'none'",
  ].join("; ");

module.exports = function (app) {
  app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", buildCsp(req.headers.host));
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    // Isolates the window but still lets the Google sign-in popup report back
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    // The dev server runs on Express; don't advertise it
    res.removeHeader("X-Powered-By");
    next();
  });
};
