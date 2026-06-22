// Business logic for classes (grade levels). Every query is fenced by schoolId
// so one school can never see or mutate another's classes. Soft-delete only
// (deletedAt) — hard-deleting a class would orphan its sections and students.
const mongoose = require('mongoose');
const Class = require('./class.model');
const Section = require('../section/section.model');
const User = require('../users/user.model');
require('../subject/subject.model'); // registered for populate('subjectId'); not queried directly here
const TeachingAssignment = require('../assignment/teachingAssignment.model');
const Assignment = require('../assignment/assignment.model');
const Submission = require('../submission/submission.model');
const ApiError = require('../../utils/ApiError');
const { USER_ROLES } = require('../../constant/constant');

const notDeleted = { deletedAt: null };

async function listClasses(schoolId) {
  return Class.find({ schoolId, deletedAt: null }).sort({ level: 1 });
}

async function getClassById(id, schoolId) {
  const doc = await Class.findOne({ _id: id, schoolId, deletedAt: null });
  if (!doc) throw ApiError.notFound('Class not found');
  return doc;
}

async function createClass(schoolId, data, userId) {
  const existing = await Class.findOne({ schoolId, level: data.level, deletedAt: null });
  if (existing) throw ApiError.conflict(`Class ${data.level} already exists`);
  return Class.create({ ...data, schoolId, createdBy: userId });
}

async function updateClass(id, schoolId, data, userId) {
  const doc = await Class.findOneAndUpdate(
    { _id: id, schoolId, deletedAt: null },
    { ...data, updatedBy: userId },
    { new: true, runValidators: true }
  );
  if (!doc) throw ApiError.notFound('Class not found');
  return doc;
}

async function deleteClass(id, schoolId, userId) {
  const doc = await Class.findOneAndUpdate(
    { _id: id, schoolId, deletedAt: null },
    { deletedAt: new Date(), updatedBy: userId },
    { new: true }
  );
  if (!doc) throw ApiError.notFound('Class not found');
  return doc;
}

// ---------------------------------------------------------------------------
// DETAIL VIEW (PRINCIPAL) — a class plus its full roster and coursework,
// aggregated across every section in the class:
//   sections    : the divisions (5-A, 5-B, ...)
//   students    : id + name + which section, across the whole class
//   subjects    : taught in the class, each with the teacher(s) (and section)
//   assignments : everything handed out to any section of the class
//   submissions : every submission filed against those assignments
// Tenant-scoped; soft-deleted hidden.
// ---------------------------------------------------------------------------
async function getClassDetail(id, schoolId) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Class not found');
  const klass = await Class.findOne({ _id: id, schoolId, ...notDeleted });
  if (!klass) throw ApiError.notFound('Class not found');

  const sections = await Section.find({ classId: id, schoolId, ...notDeleted })
    .select('name')
    .sort({ name: 1 })
    .lean();
  const sectionIds = sections.map((s) => s._id);
  const sectionNameById = new Map(sections.map((s) => [String(s._id), s.name]));

  const [students, teaching, assignments] = await Promise.all([
    User.find({ schoolId, role: USER_ROLES.STUDENT, classId: id, ...notDeleted })
      .select('name sectionId')
      .sort({ name: 1 })
      .lean(),
    TeachingAssignment.find({ sectionId: { $in: sectionIds }, schoolId, ...notDeleted })
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name')
      .lean(),
    Assignment.find({ sectionId: { $in: sectionIds }, schoolId, ...notDeleted })
      .sort({ createdAt: -1 })
      .populate({
        path: 'teachingAssignmentId',
        select: 'subjectId teacherId',
        populate: [
          { path: 'subjectId', select: 'name' },
          { path: 'teacherId', select: 'name' },
        ],
      })
      .select('title type dueDate sectionId teachingAssignmentId createdAt')
      .lean(),
  ]);

  const assignmentIds = assignments.map((a) => a._id);
  const submissions = assignmentIds.length
    ? await Submission.find({ assignmentId: { $in: assignmentIds }, schoolId, ...notDeleted })
        .sort({ submittedAt: -1 })
        .populate('studentId', 'name')
        .populate('assignmentId', 'title')
        .lean()
    : [];

  // group teaching assignments by subject -> teacher(s) in this class
  const subjectsMap = new Map();
  for (const t of teaching) {
    const subject = t.subjectId;
    if (!subject) continue;
    const key = String(subject._id);
    if (!subjectsMap.has(key)) {
      subjectsMap.set(key, { id: subject._id, name: subject.name, code: subject.code, teachers: [] });
    }
    const entry = subjectsMap.get(key);
    if (t.teacherId) {
      entry.teachers.push({
        id: t.teacherId._id,
        name: t.teacherId.name,
        sectionName: sectionNameById.get(String(t.sectionId)) ?? null,
      });
    }
  }

  return {
    id: klass._id,
    level: klass.level,
    sections: sections.map((s) => ({ id: s._id, name: s.name })),
    students: students.map((s) => ({
      id: s._id,
      name: s.name,
      sectionId: s.sectionId,
      sectionName: sectionNameById.get(String(s.sectionId)) ?? null,
    })),
    subjects: [...subjectsMap.values()],
    assignments: assignments.map((a) => ({
      id: a._id,
      title: a.title,
      type: a.type,
      dueDate: a.dueDate,
      sectionName: sectionNameById.get(String(a.sectionId)) ?? null,
      subjectName: a.teachingAssignmentId?.subjectId?.name ?? null,
      teacherName: a.teachingAssignmentId?.teacherId?.name ?? null,
      createdAt: a.createdAt,
    })),
    submissions: submissions.map((s) => ({
      id: s._id,
      assignmentId: s.assignmentId?._id ?? s.assignmentId,
      assignmentTitle: s.assignmentId?.title ?? null,
      studentId: s.studentId?._id ?? s.studentId,
      studentName: s.studentId?.name ?? null,
      status: s.status,
      grade: s.grade,
      feedback: s.feedback,
      submittedAt: s.submittedAt,
      gradedAt: s.gradedAt,
    })),
  };
}

module.exports = {
  listClasses,
  getClassById,
  getClassDetail,
  createClass,
  updateClass,
  deleteClass,
};
