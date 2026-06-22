// JWT helpers: access tokens (short-lived, carry identity + tokenVersion + jti)
// and refresh-token primitives (opaque random token + hashing for DB storage).
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../../config/env');

// ---- ACCESS TOKEN ----
// Embeds tokenVersion so a "logout everywhere" bump invalidates old tokens, and
// a jti so individual tokens can be blacklisted (logout) before natural expiry.
function signAccessToken(user) {
  const jti = crypto.randomUUID();
  const payload = {
    sub: String(user._id),
    role: user.role,
    schoolId: String(user.schoolId),
    tokenVersion: user.tokenVersion ?? 0,
    jti,
  };
  const token = jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtl, // e.g. "15m"
  });
  return { token, jti };
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.accessSecret); // throws on invalid/expired
}

// ---- REFRESH TOKEN ----
// Opaque random string (NOT a JWT). We store only its SHA-256 hash server-side,
// so a DB leak does not expose usable tokens. The raw value goes to the client
// in an httpOnly cookie.
function generateRefreshToken() {
  const raw = crypto.randomBytes(48).toString('hex');
  const hash = hashRefreshToken(raw);
  return { raw, hash };
}

function hashRefreshToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
};