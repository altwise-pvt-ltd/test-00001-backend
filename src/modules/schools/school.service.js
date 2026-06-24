// School provisioning + principal assignment — SUPER-ADMIN authority only.
//
// The "principal of a school" relation is modelled on the USER side: a principal
// is the school's principal iff that user has role 'principal' and
// schoolId == school._id. There is no principalId column on School — the
// assignment is derived, which makes "one principal per school" a property we
// maintain in the assign/unassign transactions below rather than a duplicated
// field that could drift.
const mongoose = require('mongoose');
const School = require('../../models/School');
const User = require('../users/user.model');
const ApiError = require('../../utils/ApiError');
const { USER_ROLES } = require('../../constant/constant');

const notDeleted = { deletedAt: null };

// The current principal of a school = the principal user pointed at it.
function findSchoolPrincipal(schoolId, session = null) {
  const q = User.findOne({ role: USER_ROLES.PRINCIPAL, schoolId, ...notDeleted });
  return session ? q.session(session) : q;
}

function principalSummary(principal) {
  if (!principal) return null;
  return { id: principal._id, name: principal.name, email: principal.email };
}

// ---------------------------------------------------------------------------
// CREATE — a bare school: name + address, active, no principal yet.
// ---------------------------------------------------------------------------
async function createSchool({ name, address }, createdByUserId = null) {
  const school = await School.create({
    name,
    address: address || '',
    isActive: true,
    createdBy: createdByUserId,
  });
  return school;
}

// ---------------------------------------------------------------------------
// LIST — every school with its assigned-principal summary (or null).
// One query for schools, one for their principals; joined in memory (no N+1).
// ---------------------------------------------------------------------------
async function listSchools() {
  const schools = await School.find({ ...notDeleted }).sort({ createdAt: -1 }).lean();
  if (schools.length === 0) return [];

  const schoolIds = schools.map((s) => s._id);
  const principals = await User.find({
    role: USER_ROLES.PRINCIPAL,
    schoolId: { $in: schoolIds },
    ...notDeleted,
  })
    .select('name email schoolId')
    .lean();

  const principalBySchool = new Map(principals.map((p) => [String(p.schoolId), p]));

  return schools.map((s) => ({
    id: s._id,
    name: s.name,
    address: s.address,
    isActive: s.isActive,
    createdAt: s.createdAt,
    principal: principalSummary(principalBySchool.get(String(s._id))),
  }));
}

// ---------------------------------------------------------------------------
// DETAIL — one school + its assigned-principal summary (or null).
// ---------------------------------------------------------------------------
async function getSchoolById(id) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('School not found');
  const school = await School.findOne({ _id: id, ...notDeleted }).lean();
  if (!school) throw ApiError.notFound('School not found');

  const principal = await User.findOne({ role: USER_ROLES.PRINCIPAL, schoolId: id, ...notDeleted })
    .select('name email')
    .lean();

  return {
    id: school._id,
    name: school.name,
    address: school.address,
    isActive: school.isActive,
    createdAt: school.createdAt,
    principal: principalSummary(principal),
  };
}

// ---------------------------------------------------------------------------
// ASSIGN — point a principal at a school. Atomic so a school never ends up with
// two principals and is never orphaned mid-operation. In one transaction:
//   1. validate the school exists and the principalId is a 'principal' user
//   2. if the school already has a (different) principal, UNASSIGN them
//      (schoolId = null) — this is a replacement
//   3. if the incoming principal is currently on a DIFFERENT school, that move
//      leaves their old school principal-less (handled implicitly: we just
//      repoint them; their old school now has no principal pointing at it)
//   4. set the incoming principal's schoolId = :id
// ---------------------------------------------------------------------------
async function assignPrincipal(schoolId, principalId) {
  if (!mongoose.isValidObjectId(schoolId)) throw ApiError.notFound('School not found');
  if (!mongoose.isValidObjectId(principalId)) throw ApiError.badRequest('principalId must be a valid id');

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const school = await School.findOne({ _id: schoolId, ...notDeleted }).session(session);
      if (!school) throw ApiError.notFound('School not found');

      const incoming = await User.findOne({
        _id: principalId,
        role: USER_ROLES.PRINCIPAL,
        ...notDeleted,
      }).session(session);
      if (!incoming) throw ApiError.badRequest('principalId must reference an existing principal');

      // Already the principal of this school? No-op (idempotent).
      if (incoming.schoolId && String(incoming.schoolId) === String(schoolId)) {
        result = { school, principal: incoming };
        return;
      }

      // Replacement: unassign the school's current principal (if any).
      const current = await findSchoolPrincipal(schoolId, session);
      if (current && String(current._id) !== String(incoming._id)) {
        current.schoolId = null;
        await current.save({ session });
      }

      // Repoint the incoming principal (this also vacates their old school, if any).
      incoming.schoolId = school._id;
      await incoming.save({ session });

      result = { school, principal: incoming };
    });
    return result;
  } finally {
    session.endSession();
  }
}

// ---------------------------------------------------------------------------
// UNASSIGN — clear the school's current principal (schoolId = null). The school
// becomes principal-less. 404 if the school has no principal to remove.
// ---------------------------------------------------------------------------
async function unassignPrincipal(schoolId) {
  if (!mongoose.isValidObjectId(schoolId)) throw ApiError.notFound('School not found');

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const school = await School.findOne({ _id: schoolId, ...notDeleted }).session(session);
      if (!school) throw ApiError.notFound('School not found');

      const principal = await findSchoolPrincipal(schoolId, session);
      if (!principal) throw ApiError.notFound('This school has no principal assigned');

      principal.schoolId = null;
      await principal.save({ session });

      result = { school, unassignedPrincipalId: principal._id };
    });
    return result;
  } finally {
    session.endSession();
  }
}

// ---------------------------------------------------------------------------
// ACTIVATE / DEACTIVATE — flip isActive. Deactivation soft-blocks the school's
// members at LOGIN time (see auth.service.login); existing tokens keep working.
// ---------------------------------------------------------------------------
async function setActive(schoolId, isActive, updatedByUserId = null) {
  if (!mongoose.isValidObjectId(schoolId)) throw ApiError.notFound('School not found');
  const school = await School.findOneAndUpdate(
    { _id: schoolId, ...notDeleted },
    { isActive, updatedBy: updatedByUserId },
    { new: true }
  );
  if (!school) throw ApiError.notFound('School not found');
  return school;
}

module.exports = {
  createSchool,
  listSchools,
  getSchoolById,
  assignPrincipal,
  unassignPrincipal,
  setActive,
};
