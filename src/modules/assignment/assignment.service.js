// Business logic for assignments (the homework a teacher gives out).
//
// AUTHORITY (step 4): a teacher can only create an assignment against a
// TeachingAssignment that belongs to them — that's what "only within what they
// teach" means. The section is inherited from that teaching assignment, so the
// client never chooses a section directly.
//
// SCOPING (step 5): listing/reading is filtered by role — a student only ever
// sees assignments for their own section; a teacher sees those under their own
// teaching assignments; a principal sees the whole school.
const Assignment = require('./assignment.model');
const TeachingAssignment = require('./teachingAssignment.model');
const { USER_ROLES } = require('../../constant/constant');
const ApiError = require('../../utils/ApiError');

const POPULATE = [
  { path: 'teachingAssignmentId', select: 'teacherId subjectId sectionId' },
  { path: 'sectionId', select: 'name' },
];

// Verify the teaching assignment exists in this school AND belongs to this
// teacher; return it (we need its sectionId to denormalize onto the assignment).
async function assertTeacherAuthority(teachingAssignmentId, schoolId, teacherId) {
  const ta = await TeachingAssignment.findOne({
    _id: teachingAssignmentId,
    schoolId,
    deletedAt: null,
  });
  if (!ta) {
    throw ApiError.badRequest('teachingAssignmentId does not reference a teaching assignment in this school');
  }
  if (ta.teacherId.toString() !== teacherId) {
    throw ApiError.forbidden('You can only create assignments for what you teach');
  }
  return ta;
}

// True if this user may edit/delete the assignment (its owning teacher, or any
// principal of the school).
function canManage(assignment, auth) {
  if (auth.role === USER_ROLES.PRINCIPAL) return true;
  return !!assignment.createdBy && assignment.createdBy.toString() === auth.userId;
}

async function createAssignment(schoolId, teacherId, data) {
  const { teachingAssignmentId, ...rest } = data;
  const ta = await assertTeacherAuthority(teachingAssignmentId, schoolId, teacherId);
  return Assignment.create({
    ...rest,
    teachingAssignmentId,
    sectionId: ta.sectionId, // inherited scope — not client-provided
    schoolId,
    createdBy: teacherId,
  });
}

async function listAssignments(auth, filter = {}) {
  const query = { schoolId: auth.schoolId, deletedAt: null };

  if (auth.role === USER_ROLES.STUDENT) {
    // auto-scope to the student's own section (step 5)
    query.sectionId = auth.sectionId;
  } else if (auth.role === USER_ROLES.TEACHER) {
    const myTas = await TeachingAssignment.find({
      schoolId: auth.schoolId,
      teacherId: auth.userId,
      deletedAt: null,
    }).select('_id');
    query.teachingAssignmentId = { $in: myTas.map((t) => t._id) };
  }
  // principal: no extra restriction (whole school)

  if (filter.sectionId) query.sectionId = filter.sectionId;

  return Assignment.find(query).populate(POPULATE).sort({ createdAt: -1 });
}

async function getAssignmentById(id, auth) {
  const a = await Assignment.findOne({ _id: id, schoolId: auth.schoolId, deletedAt: null }).populate(POPULATE);
  if (!a) throw ApiError.notFound('Assignment not found');

  if (auth.role === USER_ROLES.STUDENT) {
    const secId = a.sectionId && (a.sectionId._id || a.sectionId).toString();
    if (secId !== auth.sectionId) {
      throw ApiError.forbidden('This assignment is not for your section');
    }
  } else if (auth.role === USER_ROLES.TEACHER) {
    const ownerId = a.teachingAssignmentId && a.teachingAssignmentId.teacherId;
    if (!ownerId || ownerId.toString() !== auth.userId) {
      throw ApiError.forbidden('You do not teach this assignment');
    }
  }

  return a;
}

async function updateAssignment(id, auth, data) {
  const a = await Assignment.findOne({ _id: id, schoolId: auth.schoolId, deletedAt: null });
  if (!a) throw ApiError.notFound('Assignment not found');
  if (!canManage(a, auth)) {
    throw ApiError.forbidden('You can only edit assignments you created');
  }
  Object.assign(a, data, { updatedBy: auth.userId });
  await a.save();
  return a.populate(POPULATE);
}

async function deleteAssignment(id, auth) {
  const a = await Assignment.findOne({ _id: id, schoolId: auth.schoolId, deletedAt: null });
  if (!a) throw ApiError.notFound('Assignment not found');
  if (!canManage(a, auth)) {
    throw ApiError.forbidden('You can only delete assignments you created');
  }
  a.deletedAt = new Date();
  a.updatedBy = auth.userId;
  await a.save();
  return a;
}

module.exports = {
  createAssignment,
  listAssignments,
  getAssignmentById,
  updateAssignment,
  deleteAssignment,
};
