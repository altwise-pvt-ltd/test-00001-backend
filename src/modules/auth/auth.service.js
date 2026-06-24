// Authentication business logic.
//
// CHANGES FROM PRIOR VERSION:
//  - public self-registration is REMOVED. Schools are provisioned by a
//    super-admin (schools module), principals are created by a super-admin
//    (principals module), and teacher/student users are created by a
//    principal/teacher via the users module. The first super-admin is
//    bootstrapped out of band (src/scripts/createAdmin.js).
//  - email is unique PER SCHOOL (and per-role-globally for the null-school
//    roles); the user model's indexes guard creation elsewhere.
//  - sessions now use access + refresh tokens (7d sliding, rotated) plus a
//    blacklist on logout.
const bcrypt = require('bcryptjs');

const User = require('../users/user.model');
const School = require('../../models/School');
const SubjectAllocation = require('../subjectAllocation/subjectAllocation.model');
const RefreshToken = require('../../models/RefreshToken');
const BlacklistedToken = require('../../models/BlacklistedToken');
const ApiError = require('../../utils/ApiError');
const config = require('../../config/env');
const {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} = require('./jwt');
const { USER_ROLES } = require('../../constant/constant');

const REFRESH_TTL_MS = config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000;

function refreshExpiry() {
  return new Date(Date.now() + REFRESH_TTL_MS);
}

// Issue a fresh refresh token row and return the raw value (for the cookie).
async function issueRefreshToken(user, session = null) {
  const { raw, hash } = generateRefreshToken();
  const doc = {
    userId: user._id,
    tokenHash: hash,
    expiresAt: refreshExpiry(),
    schoolId: user.schoolId,
  };
  const opts = session ? { session } : {};
  const [created] = await RefreshToken.create([doc], opts);
  return { raw, id: created._id };
}

// ---------------------------------------------------------------------------
// LOGIN — per-school email; school resolved from the user record.
// Email is unique per school, so we need a schoolId to disambiguate. The client
// supplies it (e.g. chosen at login or via subdomain). If your flow keeps email
// globally unique in practice, schoolId can be omitted and looked up — but per
// the multi-tenant decision we scope by school.
//
// SCHOOL-DEACTIVATION GUARD (soft): if the resolved user belongs to a school,
// that school must be active. A deactivated school's members (principal,
// teachers, students) are blocked from logging IN — but any access tokens they
// already hold keep working until natural expiry (this is deliberately a soft
// gate, not a hard kill). Super-admins and unassigned principals (schoolId null)
// have no school and are exempt.
// ---------------------------------------------------------------------------
async function login({ email, password, schoolId }) {
  const query = schoolId ? { email, schoolId } : { email };
  const user = await User.findOne(query).select('+passwordHash');

  if (!user || !user.isActive || user.deletedAt) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  if (user.schoolId) {
    const school = await School.findById(user.schoolId).select('isActive');
    if (school && school.isActive === false) {
      throw ApiError.forbidden('This school is currently inactive');
    }
  }

  const { token: accessToken } = signAccessToken(user);
  const { raw: refreshRaw } = await issueRefreshToken(user);

  return { user, accessToken, refreshRaw };
}

// ---------------------------------------------------------------------------
// REFRESH — rotate: verify the presented refresh token, revoke it, issue a new
// one (sliding 7d), and a new access token.
// ---------------------------------------------------------------------------
async function refresh({ refreshRaw }) {
  if (!refreshRaw) throw ApiError.unauthorized('Missing refresh token');

  const hash = hashRefreshToken(refreshRaw);
  const existing = await RefreshToken.findOne({ tokenHash: hash });

  if (!existing || existing.revoked || existing.expiresAt < new Date()) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(existing.userId);
  if (!user || !user.isActive || user.deletedAt) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  // rotate: issue new, point the old one at it, revoke the old one.
  const { raw: newRaw, id: newId } = await issueRefreshToken(user);
  existing.revoked = true;
  existing.replacedBy = newId;
  await existing.save();

  const { token: accessToken } = signAccessToken(user);
  return { user, accessToken, refreshRaw: newRaw };
}

// ---------------------------------------------------------------------------
// LOGOUT — revoke the presented refresh token and blacklist the access token
// (by jti) until its natural expiry.
// ---------------------------------------------------------------------------
async function logout({ refreshRaw, accessJti, accessExp }) {
  if (refreshRaw) {
    const hash = hashRefreshToken(refreshRaw);
    await RefreshToken.updateOne({ tokenHash: hash }, { revoked: true });
  }
  if (accessJti && accessExp) {
    await BlacklistedToken.updateOne(
      { jti: accessJti },
      { jti: accessJti, expiresAt: new Date(accessExp * 1000) },
      { upsert: true }
    );
  }
}

async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  // For teachers, embed what they teach so the frontend can render it and
  // populate section pickers. The teacher↔section relation lives entirely in
  // SubjectAllocation (teacher × subject × section) — the single source of
  // truth. Names/levels are populated so the client never sees bare ObjectIds.
  if (user.role !== USER_ROLES.TEACHER) return user;

  const teaching = await SubjectAllocation.find({ teacherId: user._id, deletedAt: null })
    .populate('subjectId', 'name code')
    .populate({ path: 'sectionId', select: 'name classId', populate: { path: 'classId', select: 'level' } })
    .lean();

  return {
    ...user.toJSON(),
    teaching: teaching.map((t) => {
      const subject = t.subjectId;
      const section = t.sectionId;
      const cls = section?.classId;
      return {
        subjectAllocationId: t._id,
        subject: subject ? { id: subject._id, name: subject.name, code: subject.code } : null,
        section: section ? { id: section._id, name: section.name } : null,
        class: cls ? { id: cls._id, level: cls.level } : null,
      };
    }),
  };
}

// "log out everywhere": bump tokenVersion (kills access tokens) AND revoke all
// refresh tokens for the user.
async function logoutAll(userId) {
  await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
  await RefreshToken.updateMany({ userId, revoked: false }, { revoked: true });
}

module.exports = {
  login,
  refresh,
  logout,
  getMe,
  logoutAll,
  issueRefreshToken,
};