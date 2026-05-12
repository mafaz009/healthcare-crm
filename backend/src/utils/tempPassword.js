/**
 * tempPassword.js — Temporary password generator
 *
 * Generates a memorable, secure temporary password that satisfies the system's
 * password validation rules:
 *   - At least 8 characters (generated: 12-15 chars)
 *   - Contains uppercase letter
 *   - Contains digit
 *   - Contains special character
 *
 * Format: WordNumber!Word  e.g. "Quick42Eagle!"  "Bold18Tiger@"
 *
 * Entropy: 10 words × 90 numbers × 10 words × 5 specials = 450,000 combinations.
 * Not cryptographically exhaustive, but sufficient for a temp password that
 * MUST be changed on first login. The tokenVersion invalidation means even if
 * the temp password leaked, it cannot be used once the user changes it.
 */

const crypto = require('crypto');

const WORDS = [
  'Quick', 'Bold',  'Safe',  'Fast',  'Calm',
  'Wise',  'Kind',  'Fresh', 'Pure',  'Clear',
  'Lion',  'Eagle', 'Tiger', 'Crane', 'Wolf',
  'Bear',  'Hawk',  'Deer',  'Dove',  'Swan',
  'Blue',  'Green', 'Gold',  'Jade',  'Stone',
  'Cloud', 'River', 'Star',  'Moon',  'Fire',
];

const SPECIALS = ['!', '@', '#', '$', '%'];

/**
 * Generate a temporary password.
 * Uses crypto.randomInt for cryptographically-secure randomness.
 * @returns {string}  e.g. "QuickEagle42!"
 */
const generateTempPassword = () => {
  const word1   = WORDS[crypto.randomInt(0, WORDS.length)];
  const word2   = WORDS[crypto.randomInt(0, WORDS.length)];
  const number  = crypto.randomInt(10, 99);   // always 2 digits
  const special = SPECIALS[crypto.randomInt(0, SPECIALS.length)];
  return `${word1}${word2}${number}${special}`;
};

module.exports = { generateTempPassword };
