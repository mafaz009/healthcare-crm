/**
 * loginId.js — username generation, validation, and uniqueness enforcement
 *
 * loginId is the PRIMARY AUTH IDENTITY used to log into the CRM.
 * It is separate from email, which is a communication address only.
 *
 * FORMAT RULES
 *   • 3–50 characters
 *   • Lowercase alphanumeric, dots (.), hyphens (-), underscores (_)
 *   • Must start AND end with an alphanumeric character
 *   • No consecutive dots/hyphens/underscores
 *   • Examples: admin · dr.manmeet · staff.priya.2 · mashhealth.crm
 *
 * GENERATION STRATEGY
 *   Derives a base from a name or email prefix, sanitises it to the allowed
 *   charset, then appends incrementing suffixes (.2, .3, …) until unique.
 *   The DB UNIQUE constraint is the authoritative safety net.
 */

const prisma = require('../config/database');

// ── Format validation ─────────────────────────────────────────────────────────

/**
 * Regex for a valid loginId:
 *   ^[a-z0-9]           — must start with alphanumeric
 *   [a-z0-9._-]{1,48}   — 1–48 chars of alphanumeric/dot/hyphen/underscore
 *   [a-z0-9]$           — must end with alphanumeric
 * Total: 3–50 chars.
 *
 * Additionally checked: no consecutive separator chars (.. / -- / __ / .- etc.)
 */
const LOGIN_ID_REGEX = /^[a-z0-9][a-z0-9._-]{1,48}[a-z0-9]$/;
const CONSECUTIVE_SEPARATORS = /[._-]{2,}/;

const isValidLoginId = (id) =>
  LOGIN_ID_REGEX.test(id) && !CONSECUTIVE_SEPARATORS.test(id);

// ── Sanitise free text → valid base ──────────────────────────────────────────

/**
 * Turn a name ("Dr. Manmeet Singh") or email ("dr.manmeet@gmail.com") into a
 * valid, lowercase loginId base string.  Result is max 40 chars so that a
 * collision suffix (".123") can always be appended within the 50-char limit.
 */
const sanitize = (input) => {
  let base = (input || '')
    .replace(/@.*$/, '')            // strip @domain if this is an email
    .toLowerCase()
    .replace(/\s+/g, '.')           // spaces → dots  ("Dr Manmeet" → "dr.manmeet")
    .replace(/[^a-z0-9._-]/g, '')   // drop all chars not in the allowed set
    .replace(/[._-]{2,}/g, '.')     // collapse consecutive separators → single dot
    .replace(/^[^a-z0-9]+/, '')     // strip leading separator chars
    .replace(/[^a-z0-9]+$/, '')     // strip trailing separator chars
    .slice(0, 40);                  // leave room for collision suffix

  // Fallback for empty or very short results
  if (base.length < 3) {
    base = base.length > 0 ? `user.${base}` : 'user';
  }

  return base;
};

// ── Uniqueness guarantee ──────────────────────────────────────────────────────

/**
 * Generate a loginId that is guaranteed unique in the users table.
 *
 * @param {string}  input         — display name or email to derive from
 * @param {number|null} excludeId — user id to skip when checking (for updates)
 * @returns {Promise<string>}
 *
 * Collision resolution:
 *   "dr.manmeet" taken → "dr.manmeet.2" → "dr.manmeet.3" → …
 */
const uniqueLoginId = async (input, excludeId = null) => {
  const base = sanitize(input);
  let candidate = base;
  let n = 1;

  for (;;) {
    const existing = await prisma.user.findUnique({
      where: { loginId: candidate },
      select: { id: true },
    });

    // Available if: no row found, OR the only row found IS the user being updated
    if (!existing || (excludeId != null && existing.id === excludeId)) {
      return candidate;
    }

    n += 1;
    // Re-derive with suffix — always within 50-char limit because base ≤ 40 chars
    candidate = `${base}.${n}`;
  }
};

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = { isValidLoginId, sanitize, uniqueLoginId, LOGIN_ID_REGEX };
