// Business logic for submissions.
//
// SUBMIT (step 6): a student submits to an assignment, but only one that
// belongs to their own section. One submission per student per assignment
// (enforced by a unique index; we also pre-check for a friendly 409).
//
// GRADE (step 7): only a teacher who actually teaches the assignment (via its
// TeachingAssignment) may grade its submissions.
const Submission = require('./submission.model');
const Assignment = require('../assignment/assignment.model');
const TeachingAssignment = require('../assignment/teachingAssignment.model');
const { USER_ROLES, SUBMISSION_STATUS } = require('../../constant/constant');
const ApiError = require('../../utils/ApiError');

const POPULATE = [
  { path: 'studentId', select: 'name email' },
  { path: 'assignmentId', select: 'title sectionId' },
];

// Verify the given teacher teaches the assignment; returns the assignment.
async function assertTeacherTeachesAssignment(assignmentId, auth) {
  const a = await Assignment.findOne({
    _id: assignmentId,
    schoolId: auth.schoolId,
    deletedAt: null,
  }).populate('teachingAssignmentId', 'teacherId');
  if (!a) throw ApiError.notFound('Assignment not found');
  const ownerId = a.teachingAssignmentId && a.teachingAssignmentId.teacherId;
  if (!ownerId || ownerId.toString() !== auth.userId) {
    throw ApiError.forbidden('You do not teach this assignment');
  }
  return a;
}

async function createSubmission(auth, data) {
  const assignment = await Assignment.findOne({
    _id: data.assignmentId,
    schoolId: auth.schoolId,
    deletedAt: null,
  });
  if (!assignment) {
    throw ApiError.badRequest('assignmentId does not reference an assignment in this school');
  }

  // A student may only submit to assignments for their own section.
  if (!auth.sectionId || assignment.sectionId.toString() !== auth.sectionId) {
    throw ApiError.forbidden('You can only submit to assignments for your own section');
  }

  const existing = await Submission.findOne({
    assignmentId: data.assignmentId,
    studentId: auth.userId,
    deletedAt: null,
  });
  if (existing) throw ApiError.conflict('You have already submitted to this assignment');

  return Submission.create({
    assignmentId: data.assignmentId,
    studentId: auth.userId,
    content: data.content || '',
    attachments: data.attachments || [],
    status: SUBMISSION_STATUS.SUBMITTED,
    schoolId: auth.schoolId,
  });
}

async function listSubmissions(auth, filter = {}) {
  const query = { schoolId: auth.schoolId, deletedAt: null };

  if (auth.role === USER_ROLES.STUDENT) {
    query.studentId = auth.userId; // students only see their own
    if (filter.assignmentId) query.assignmentId = filter.assignmentId;
  } else if (auth.role === USER_ROLES.TEACHER) {
    if (filter.assignmentId) {
      await assertTeacherTeachesAssignment(filter.assignmentId, auth);
      query.assignmentId = filter.assignmentId;
    } else {
      // every assignment under the teacher's teaching assignments
      const myTas = await TeachingAssignment.find({
        schoolId: auth.schoolId,
        teacherId: auth.userId,
        deletedAt: null,
      }).select('_id');
      const mine = await Assignment.find({
        schoolId: auth.schoolId,
        teachingAssignmentId: { $in: myTas.map((t) => t._id) },
        deletedAt: null,
      }).select('_id');
      query.assignmentId = { $in: mine.map((a) => a._id) };
    }
  } else if (filter.assignmentId) {
    // principal: whole school, optionally filtered
    query.assignmentId = filter.assignmentId;
  }

  return Submission.find(query).populate(POPULATE).sort({ createdAt: -1 });
}

async function getSubmissionById(id, auth) {
  const s = await Submission.findOne({ _id: id, schoolId: auth.schoolId, deletedAt: null }).populate(POPULATE);
  if (!s) throw ApiError.notFound('Submission not found');

  if (auth.role === USER_ROLES.STUDENT) {
    const ownerId = s.studentId && (s.studentId._id || s.studentId).toString();
    if (ownerId !== auth.userId) throw ApiError.forbidden('This submission is not yours');
  } else if (auth.role === USER_ROLES.TEACHER) {
    const assignmentId = s.assignmentId && (s.assignmentId._id || s.assignmentId);
    await assertTeacherTeachesAssignment(assignmentId, auth);
  }

  return s;
}

async function gradeSubmission(id, auth, data) {
  const s = await Submission.findOne({ _id: id, schoolId: auth.schoolId, deletedAt: null });
  if (!s) throw ApiError.notFound('Submission not found');

  await assertTeacherTeachesAssignment(s.assignmentId, auth);

  s.grade = data.grade;
  if (data.feedback !== undefined) s.feedback = data.feedback;
  s.gradedBy = auth.userId;
  s.gradedAt = new Date();
  s.status = SUBMISSION_STATUS.GRADED;
  await s.save();

  return s.populate(POPULATE);
}

module.exports = {
  createSubmission,
  listSubmissions,
  getSubmissionById,
  gradeSubmission,
};
