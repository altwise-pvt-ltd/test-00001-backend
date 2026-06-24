// Principal provisioning — SUPER-ADMIN authority only.
//
// A principal is created STANDALONE and UNASSIGNED (schoolId null). Assigning a
// principal to a school is a SEPARATE operation that lives in the schools module
// (PATCH /api/schools/:id/principal) — creation and assignment are deliberately
// decoupled. The super-admin sets the principal's password directly (it is NOT
// derived from a date of birth the way teacher/student passwords are).
const bcrypt = require('bcryptjs');
const User = require('../users/user.model');
const School = require('../../models/School');
const ApiError = require('../../utils/ApiError');
const config = require('../../config/env');
const { USER_ROLES } = require('../../constant/constant');

const notDeleted = { deletedAt: null };

// Create a standalone, unassigned principal. Email must be unique among
// principals (backed by the uniq_principal_email partial index; checked here for
// a friendly 409). createdBy is the super-admin who created them.
async function createPrincipal({ name, email, password }, createdByUserId = null) {
  const existing = await User.findOne({ email, role: USER_ROLES.PRINCIPAL, ...notDeleted });
  if (existing) {
    throw ApiError.conflict('A principal with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

  const principal = await User.create({
    name,
    email,
    passwordHash,
    role: USER_ROLES.PRINCIPAL,
    schoolId: null, // unassigned until given a school
    createdBy: createdByUserId,
  });

  return principal;
}

// List every principal with the school they are assigned to (id + name) or null.
// Principals with schoolId null are the UNASSIGNED POOL — the super-admin uses
// this to see who still needs a school. Newest first.
async function listPrincipals() {
  const principals = await User.find({ role: USER_ROLES.PRINCIPAL, ...notDeleted })
    .select('name email isActive schoolId createdAt')
    .sort({ createdAt: -1 })
    .lean();

  const schoolIds = principals.map((p) => p.schoolId).filter(Boolean);
  const schools = schoolIds.length
    ? await School.find({ _id: { $in: schoolIds }, ...notDeleted }).select('name').lean()
    : [];
  const schoolById = new Map(schools.map((s) => [String(s._id), s]));

  return principals.map((p) => {
    const school = p.schoolId ? schoolById.get(String(p.schoolId)) : null;
    return {
      id: p._id,
      name: p.name,
      email: p.email,
      isActive: p.isActive,
      createdAt: p.createdAt,
      assignedSchool: school ? { id: school._id, name: school.name } : null,
    };
  });
}

module.exports = { createPrincipal, listPrincipals };
