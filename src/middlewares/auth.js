// Authentication + authorization middleware.
//
// requireAuth  - verifies the Bearer ACCESS token, ensures it has not been
//                blacklisted (explicit logout), loads the user, and enforces
//                that the token is still valid (account active, not soft-deleted,
//                and tokenVersion matches — so "logout everywhere" works).
// requireRole  - gate a route to one or more roles. Must run AFTER requireAuth.
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../modules/auth/jwt');
const User = require('../modules/users/user.model');
const BlacklistedToken = require('../models/BlacklistedToken');

const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Missing or malformed Authorization header');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  // Reject access tokens that were explicitly revoked at logout (by jti).
  if (payload.jti) {
    const blacklisted = await BlacklistedToken.exists({ jti: payload.jti });
    if (blacklisted) {
      throw ApiError.unauthorized('Token has been revoked');
    }
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive || user.deletedAt) {
    throw ApiError.unauthorized('Account is no longer active');
  }
  if (user.tokenVersion !== payload.tokenVersion) {
    throw ApiError.unauthorized('Token has been revoked');
  }

  // Attach a compact, trusted identity for downstream handlers.
  req.user = user;
  req.auth = {
    userId: user._id.toString(),
    // null for super-admins and unassigned principals (they have no school).
    schoolId: user.schoolId ? user.schoolId.toString() : null,
    role: user.role,
    // null for principals/teachers; set for students (used to auto-scope their
    // view of assignments to their own section).
    sectionId: user.sectionId ? user.sectionId.toString() : null,
    // token identifiers — used by logout to blacklist this exact access token.
    jti: payload.jti,
    exp: payload.exp,
  };
  next();
});

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    if (!roles.includes(req.auth.role)) {
      return next(ApiError.forbidden('Insufficient permissions'));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
