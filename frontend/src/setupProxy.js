// Loaded automatically by the react-scripts dev server (not bundled into the app).
// Adds security headers to every page it serves. A production host must send
// the same headers (see docs/IT22077356/vuln-missing-security-headers.md).
module.exports = function (app) {
  app.use((req, res, next) => {
    // Clickjacking: the app may never be shown inside a frame
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    // Isolates the window but still lets the Google sign-in popup report back
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    next();
  });
};
