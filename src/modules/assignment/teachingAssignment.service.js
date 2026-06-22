// Business logic for teaching assignments — the authority join that says
// "teacher T teaches subject S to section X". Creating one is a PRINCIPAL action.
// We verify every ref belongs to this school (and that the teacher is really a
// teacher) so the authority data can be trusted downstream by the assignment
// and grading flows. Soft-delete only.
const TeachingAssignment = require('./teachingAssignment.model');
const User = require('../users/user.model');
const Subject = require('../subject/subject.model');
const Section = require('../section/section.model');
const { USER_ROLES } = require('../../constant/constant');
const ApiError = require('../../utils/ApiError');

async function listTeachingAssignments(schoolId, filter = {}) {
  const query = { schoolId, deletedAt: null };
  if (filter.teacherId) query.teacherId = filter.teacherId;
  if (filter.sectionId) query.sectionId = filter.sectionId;
  if (filter.subjectId) query.subjectId = filter.subjectId;
  return TeachingAssignment.find(query)
    .populate('teacherId', 'name email')
    .populate('subjectId', 'name code')
    .populate('sectionId', 'name')
    .sort({ createdAt: -1 });
}

async function createTeachingAssignment(schoolId, data, userId) {
  const { teacherId, subjectId, sectionId } = data;

  const teacher = await User.findOne({ _id: teacherId, schoolId, deletedAt: null });
  if (!teacher || teacher.role !== USER_ROLES.TEACHER) {
    throw ApiError.badRequest('teacherId must reference a teacher in this school');
  }

  const subject = await Subject.findOne({ _id: subjectId, schoolId, deletedAt: null });
  if (!subject) {
    throw ApiError.badRequest('subjectId must reference a subject in this school');
  }

  const section = await Section.findOne({ _id: sectionId, schoolId, deletedAt: null });
  if (!section) {
    throw ApiError.badRequest('sectionId must reference a section in this school');
  }

  const existing = await TeachingAssignment.findOne({
    teacherId,
    subjectId,
    sectionId,
    deletedAt: null,
  });
  if (existing) throw ApiError.conflict('This teaching assignment already exists');

  return TeachingAssignment.create({ teacherId, subjectId, sectionId, schoolId, createdBy: userId });
}

// Replace a teacher's WHOLE set of teaching assignments (subject+section pairs)
// with `desired`. Principal action. Diff-based so the caller just sends the
// target set and we work out what to add/revive/remove:
//   - pair already active            -> keep
//   - pair exists but soft-deleted   -> revive (deletedAt = null). We must revive
//        rather than re-create because the unique index {teacher,subject,section}
//        ignores deletedAt, so a fresh create on the same triple would E11000.
//   - pair not present at all         -> create
//   - active pair NOT in desired      -> soft-delete
// Returns a summary of what changed.
async function syncTeacherAssignments(schoolId, teacherId, desired, userId) {
  const teacher = await User.findOne({ _id: teacherId, schoolId, deletedAt: null });
  if (!teacher || teacher.role !== USER_ROLES.TEACHER) {
    throw ApiError.notFound('Teacher not found');
  }

  // de-dupe the incoming pairs by subject+section
  const pairs = [];
  const desiredKeys = new Set();
  for (const d of desired) {
    const key = `${d.subjectId}|${d.sectionId}`;
    if (desiredKeys.has(key)) continue;
    desiredKeys.add(key);
    pairs.push(d);
  }

  // every subject + section must belong to this school
  for (const { subjectId, sectionId } of pairs) {
    const subject = await Subject.findOne({ _id: subjectId, schoolId, deletedAt: null });
    if (!subject) throw ApiError.badRequest(`subjectId ${subjectId} is not a subject in this school`);
    const section = await Section.findOne({ _id: sectionId, schoolId, deletedAt: null });
    if (!section) throw ApiError.badRequest(`sectionId ${sectionId} is not a section in this school`);
  }

  // current rows for this teacher, INCLUDING soft-deleted (so we can revive)
  const existing = await TeachingAssignment.find({ teacherId, schoolId });
  const existingByKey = new Map(existing.map((t) => [`${t.subjectId}|${t.sectionId}`, t]));

  let created = 0;
  let revived = 0;
  let removed = 0;

  // add or revive everything in the desired set
  for (const { subjectId, sectionId } of pairs) {
    const doc = existingByKey.get(`${subjectId}|${sectionId}`);
    if (!doc) {
      await TeachingAssignment.create({ teacherId, subjectId, sectionId, schoolId, createdBy: userId });
      created += 1;
    } else if (doc.deletedAt) {
      doc.deletedAt = null;
      doc.updatedBy = userId;
      await doc.save();
      revived += 1;
    }
  }

  // soft-delete active rows that are no longer wanted
  for (const t of existing) {
    if (!t.deletedAt && !desiredKeys.has(`${t.subjectId}|${t.sectionId}`)) {
      t.deletedAt = new Date();
      t.updatedBy = userId;
      await t.save();
      removed += 1;
    }
  }

  return { created, revived, removed };
}

async function deleteTeachingAssignment(id, schoolId, userId) {
  const doc = await TeachingAssignment.findOneAndUpdate(
    { _id: id, schoolId, deletedAt: null },
    { deletedAt: new Date(), updatedBy: userId },
    { new: true }
  );
  if (!doc) throw ApiError.notFound('Teaching assignment not found');
  return doc;
}

module.exports = {
  listTeachingAssignments,
  createTeachingAssignment,
  syncTeacherAssignments,
  deleteTeachingAssignment,
};
