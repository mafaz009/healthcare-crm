/**
 * rateLimiter.js — Per-route rate limiting
 *
 * Uses express-rate-limit (already a transitive dep via many Express setups).
 * Install if not present: npm install express-rate-limit
 *
 * Three limiters:
 *   authLimiter    — login endpoint: 10 attempts per 15 min per IP
 *   apiLimiter     — general API: 120 req/min per IP
 *   publicLimiter  — public/external endpoints: 60 req/min per IP
 *                    (applied to /api/public/* used by PHP doctor websites)
 */

const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: 'Too many login attempts. Please wait 15 minutes before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Key by IP only for auth — not by user (user is unknown at login time)
  keyGenerator: (req) =>
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.ip,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  message: {
    success: false,
    message: 'Rate limit exceeded. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const publicLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: {
    success: false,
    message: 'Rate limit exceeded for public API.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Key by API key when present, otherwise by IP — prevents key-sharing abuse
  keyGenerator: (req) =>
    req.headers['x-api-key']
    || req.query.apiKey
    || (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.ip,
});

module.exports = { authLimiter, apiLimiter, publicLimiter };
