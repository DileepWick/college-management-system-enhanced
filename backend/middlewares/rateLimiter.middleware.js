const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const ApiResponse = require("../utils/ApiResponse");

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

// Emails are normalised so "User@x.com" and "user@x.com" share one counter
const normaliseEmail = (email) => String(email || "").trim().toLowerCase();

const createLimiter = ({
  windowMs,
  limit,
  message,
  keyGenerator,
  skipSuccessfulRequests = false,
}) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator,
    skipSuccessfulRequests,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) => ApiResponse.error(message, 429).send(res),
  });

// Brute force: failed logins per IP + account. Keying on both stops one source
// from guessing a password without locking out everyone behind a shared campus IP.
const loginLimiter = createLimiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip)}:${normaliseEmail(req.body?.email)}`,
  message: "Too many login attempts. Please try again in 15 minutes.",
});

// Inbox flooding: reset emails per target address, whatever IP they come from
const resetRequestLimiter = createLimiter({
  windowMs: ONE_HOUR,
  limit: 3,
  keyGenerator: (req) =>
    normaliseEmail(req.body?.email) || ipKeyGenerator(req.ip),
  message: "Too many password reset requests. Please try again in an hour.",
});

// Reset token guessing: submissions of the reset form per IP
const resetSubmitLimiter = createLimiter({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  message: "Too many password reset attempts. Please try again in 15 minutes.",
});

module.exports = { loginLimiter, resetRequestLimiter, resetSubmitLimiter };
