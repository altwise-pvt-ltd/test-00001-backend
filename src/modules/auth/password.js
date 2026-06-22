// Generates initial passwords from a user's name + date of birth, by role.
//
// Rules (see project decisions):
//   student : first 4 letters of first name (lowercase) + DDMMYYYY
//             e.g. "Rahul Sharma" / 2011-03-15  ->  "rahu15032011"
//   teacher : first 4 letters of first name (lowercase) + "@" + DDMMYYYY
//             e.g. "Anita Verma" / 1990-07-02   ->  "anit@02071990"
//   principal: NOT generated here — principals choose their own password.
//
// NOTE: these are LOW-ENTROPY, predictable credentials (derived from public-ish
// info). They are acceptable for this project's test/demo use only. They are
// intentionally permanent (no forced change) per project decision.

const { USER_ROLES } = require('../../constant/constant');

// First N letters of the first word of the name, letters only, lowercased.
// If the first word is shorter than N, the whole (sanitized) first word is used.
function nameStub(name, n = 4) {
  const firstWord = String(name || '').trim().split(/\s+/)[0] || '';
  const lettersOnly = firstWord.replace(/[^a-zA-Z]/g, '').toLowerCase();
  return lettersOnly.slice(0, n);
}

// DOB -> "DDMMYYYY" with zero-padding. Accepts a Date or a parseable date string.
function dobDDMMYYYY(dob) {
  const d = dob instanceof Date ? dob : new Date(dob);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid date of birth');
  }
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getUTCFullYear());
  return `${dd}${mm}${yyyy}`;
}

// Build the initial password for a created (teacher/student) user.
// principals are rejected — they supply their own password.
function generateInitialPassword({ role, name, dateOfBirth }) {
  if (role === USER_ROLES.PRINCIPAL) {
    throw new Error('Principals set their own password; do not generate one');
  }
  const stub = nameStub(name, 4);
  const dob = dobDDMMYYYY(dateOfBirth);

  if (role === USER_ROLES.STUDENT) {
    return `${stub}${dob}`;
  }
  if (role === USER_ROLES.TEACHER) {
    return `${stub}@${dob}`;
  }
  throw new Error(`Cannot generate password for role: ${role}`);
}

module.exports = { generateInitialPassword, nameStub, dobDDMMYYYY };