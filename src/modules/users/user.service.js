// User creation/management. Replaces open registration for teacher/student.
//
// AUTHORITY:
//   principal -> create teacher OR student in OWN school
//   teacher   -> create student only, in OWN school + OWN section
// schoolId always comes from the CREATOR (req.auth), never the request body.
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('./user.model');
const Class = require('../class/class.model');
const Section = require('../section/section.model');
require('../subject/subject.model'); // registered for populate('subjectId'); not queried directly here
const SubjectAllocation = require('../subjectAllocation/subjectAllocation.model');
const Assignment = require('../assignment/assignment.model');
const Submission = require('../submission/submission.model');
const ApiError = require('../../utils/ApiError');
const config = require('../../config/env');
const { generateInitialPassword } = require('../auth/password');
const { USER_ROLES, SUBMISSION_STATUS } = require('../../constant/constant');

const notDeleted = { deletedAt: null };

// creator: { userId, role, schoolId } from req.auth
async function createUser(creator, body) {
  const { name, email, role, dateOfBirth, classId, sectionId } = body;

  // --- authority checks ---
  if (creator.role === USER_ROLES.STUDENT) {
    throw ApiError.forbidden('Students cannot create users');
  }
  if (creator.role === USER_ROLES.TEACHER && role !== USER_ROLES.STUDENT) {
    throw ApiError.forbidden('Teachers can only create students');
  }
  if (role === USER_ROLES.PRINCIPAL) {
    throw ApiError.forbidden('Principals are created via registration, not here');
  }

  // A teacher may only create students in a section they actually teach. The
  // teacher↔section relation lives entirely in SubjectAllocation (teacher ×
  // subject × section), so derive the allowed sections from there. Teachers
  // carry sectionId = null by design.
  if (creator.role === USER_ROLES.TEACHER) {
    const teaching = await SubjectAllocation.find({ teacherId: creator.userId, ...notDeleted })
      .select('sectionId')
      .lean();

    // the sections this teacher teaches (any subject)
    const taughtSections = new Set(teaching.map((t) => String(t.sectionId)));

    if (!sectionId || !taughtSections.has(String(sectionId))) {
      throw ApiError.forbidden('Teachers can only add students to sections they teach');
    }
    // the student's class must be the one that actually owns the chosen section —
    // SubjectAllocation carries sectionId, the Section doc carries its classId.
    if (classId) {
      const section = await Section.findOne({ _id: sectionId, ...notDeleted }).select('classId').lean();
      if (!section || String(classId) !== String(section.classId)) {
        throw ApiError.badRequest('sectionId does not belong to the provided classId');
      }
    }
  }

  // students require class + section; teachers must not carry them
  if (role === USER_ROLES.STUDENT && (!classId || !sectionId)) {
    throw ApiError.badRequest('Students require classId and sectionId');
  }
  if (role === USER_ROLES.TEACHER && (classId || sectionId)) {
    throw ApiError.badRequest('Teachers must not have classId/sectionId');
  }

  // schoolId is taken from the creator's token — NOT the body.
  const schoolId = creator.schoolId;

  // per-school email uniqueness
  const existing = await User.findOne({ schoolId, email });
  if (existing) {
    throw ApiError.conflict('A user with this email already exists in this school');
  }

  // DOB-derived password (teacher/student)
  const initialPassword = generateInitialPassword({ role, name, dateOfBirth });
  const passwordHash = await bcrypt.hash(initialPassword, config.bcryptRounds);

  const user = await User.create({
    name,
    email,
    passwordHash,
    role,
    schoolId,
    classId: role === USER_ROLES.STUDENT ? classId : null,
    sectionId: role === USER_ROLES.STUDENT ? sectionId : null,
    dateOfBirth,
    createdBy: creator.userId,
  });

  // Return the user AND the plaintext initial password ONCE, so the principal
  // can communicate it. (It is derivable from name+DOB anyway by design.)
  return { user, initialPassword };
}

// ---------------------------------------------------------------------------
// READ — always tenant-scoped by the caller's schoolId; soft-deleted hidden.
// ---------------------------------------------------------------------------
async function listUsers(schoolId) {
  return User.find({ schoolId, deletedAt: null }).sort({ createdAt: -1 });
}

// Principal-facing table lists: just enough columns to render a directory table,
// not the full detail payload. Sorted by name for a predictable display order.
// Both `subjects` and `classes` derive from SubjectAllocation (teacher × subject
// × section), the single source of truth for what a teacher teaches and where.
//   subjects : de-duped subjects the teacher teaches
//   classes  : de-duped classes (each with the sections within it) they teach in
async function listTeachers(schoolId) {
  const teachers = await User.find({ schoolId, role: USER_ROLES.TEACHER, ...notDeleted })
    .select('name email isActive createdAt')
    .sort({ name: 1 })
    .lean();

  if (teachers.length === 0) return [];

  // One query for ALL teachers' subject allocations, then group in memory (no N+1).
  const teacherIds = teachers.map((t) => t._id);
  const teaching = await SubjectAllocation.find({ teacherId: { $in: teacherIds }, schoolId, ...notDeleted })
    .populate('subjectId', 'name code')
    .populate({ path: 'sectionId', select: 'name classId', populate: { path: 'classId', select: 'level' } })
    .lean();

  // teacherId -> de-duped subjects, and teacherId -> classId -> { class + sections }
  const subjectsByTeacher = new Map();
  const classesByTeacher = new Map();
  for (const t of teaching) {
    const key = String(t.teacherId);

    const subject = t.subjectId;
    if (subject) {
      if (!subjectsByTeacher.has(key)) subjectsByTeacher.set(key, new Map());
      subjectsByTeacher
        .get(key)
        .set(String(subject._id), { id: subject._id, name: subject.name, code: subject.code });
    }

    const section = t.sectionId;
    const cls = section?.classId;
    if (section && cls) {
      if (!classesByTeacher.has(key)) classesByTeacher.set(key, new Map());
      const classMap = classesByTeacher.get(key);
      if (!classMap.has(String(cls._id))) {
        classMap.set(String(cls._id), { classId: cls._id, classLevel: cls.level ?? null, sections: new Map() });
      }
      classMap
        .get(String(cls._id))
        .sections.set(String(section._id), { sectionId: section._id, sectionName: section.name ?? null });
    }
  }

  return teachers.map((t) => {
    const subjects = subjectsByTeacher.get(String(t._id));
    const classes = classesByTeacher.get(String(t._id));
    return {
      id: t._id,
      name: t.name,
      email: t.email,
      isActive: t.isActive,
      createdAt: t.createdAt,
      subjects: subjects ? [...subjects.values()] : [],
      classes: classes
        ? [...classes.values()].map((c) => ({ ...c, sections: [...c.sections.values()] }))
        : [],
    };
  });
}

// TEACHER read-scoping (CHANGE 6): a principal sees ALL students in their school;
// a teacher sees ONLY students in a section they actually teach (derived from
// their SubjectAllocation rows). The caller's identity/role comes from req.auth.
async function listStudents(auth) {
  const schoolId = auth.schoolId;
  const query = { schoolId, role: USER_ROLES.STUDENT, ...notDeleted };

  if (auth.role === USER_ROLES.TEACHER) {
    const taughtSectionIds = await SubjectAllocation.find({ teacherId: auth.userId, schoolId, ...notDeleted })
      .distinct('sectionId');
    // A teacher with no allocations teaches no sections -> sees no students.
    query.sectionId = { $in: taughtSectionIds };
  }

  const students = await User.find(query)
    .select('name email isActive classId sectionId createdAt')
    .populate('classId', 'level')
    .populate('sectionId', 'name')
    .sort({ name: 1 })
    .lean();

  return students.map((s) => ({
    id: s._id,
    name: s.name,
    email: s.email,
    isActive: s.isActive,
    classLevel: s.classId?.level ?? null,
    sectionName: s.sectionId?.name ?? null,
    createdAt: s.createdAt,
  }));
}

async function getUserById(id, schoolId) {
  const user = await User.findOne({ _id: id, schoolId, deletedAt: null });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

// ---------------------------------------------------------------------------
// UPDATE — limited, safe fields only (see user.validation.validateUpdateUser).
// ---------------------------------------------------------------------------
async function updateUser(id, schoolId, body) {
  const user = await User.findOne({ _id: id, schoolId, deletedAt: null });
  if (!user) throw ApiError.notFound('User not found');

  if (body.name !== undefined) user.name = body.name;
  if (body.isActive !== undefined) user.isActive = body.isActive;

  await user.save();
  return user;
}

// ---------------------------------------------------------------------------
// DELETE — soft delete: mark deletedAt + deactivate so the row stays for audit.
// ---------------------------------------------------------------------------
async function deleteUser(id, schoolId) {
  const user = await User.findOne({ _id: id, schoolId, deletedAt: null });
  if (!user) throw ApiError.notFound('User not found');

  user.deletedAt = new Date();
  user.isActive = false;
  await user.save();
}

// ---------------------------------------------------------------------------
// DETAIL VIEWS — a single user PLUS the related world the UI needs on a profile
// click. Tenant-scoped; soft-deleted hidden. Each rejects an id of the wrong
// role with a 404 (a student id on the teacher route is "Teacher not found").
// ---------------------------------------------------------------------------

// Guard so an unparseable :id is a clean 404 rather than a Mongoose CastError 500.
function ensureFound(id, label) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound(`${label} not found`);
}

// getTeacherById: the teacher + everything they teach/created.
//   subjects / classes / sections : de-duped across all their subject allocations
//   subjectAllocations            : the raw "teaches subject S to section X" rows
//   assignments                   : work they handed out, newest first
async function getTeacherById(id, schoolId) {
  ensureFound(id, 'Teacher');
  const teacher = await User.findOne({ _id: id, schoolId, role: USER_ROLES.TEACHER, ...notDeleted });
  if (!teacher) throw ApiError.notFound('Teacher not found');

  const teaching = await SubjectAllocation.find({ teacherId: id, schoolId, ...notDeleted })
    .populate('subjectId', 'name code')
    .populate({ path: 'sectionId', select: 'name classId', populate: { path: 'classId', select: 'level' } })
    .lean();

  const allocationIds = teaching.map((t) => t._id);

  const assignments = await Assignment.find({ subjectAllocationId: { $in: allocationIds }, schoolId, ...notDeleted })
    .sort({ createdAt: -1 })
    .populate('sectionId', 'name')
    .select('title type dueDate sectionId createdAt')
    .lean();

  // de-dupe the related entities the teacher touches across all allocations
  const subjects = new Map();
  const classes = new Map();
  const sections = new Map();

  const subjectAllocations = teaching.map((t) => {
    const subject = t.subjectId;
    const section = t.sectionId;
    const cls = section?.classId;
    if (subject) subjects.set(String(subject._id), { id: subject._id, name: subject.name, code: subject.code });
    if (cls) classes.set(String(cls._id), { id: cls._id, level: cls.level });
    if (section) {
      sections.set(String(section._id), { id: section._id, name: section.name, classLevel: cls?.level ?? null });
    }
    return {
      id: t._id,
      subject: subject ? { id: subject._id, name: subject.name, code: subject.code } : null,
      section: section ? { id: section._id, name: section.name } : null,
      classLevel: cls?.level ?? null,
    };
  });

  // The teacher's classes/sections are derived below from SubjectAllocation
  // (the single source of truth) — there is no separate class-assignment relation.
  return {
    ...teacher.toJSON(),
    subjects: [...subjects.values()],
    classes: [...classes.values()],
    sections: [...sections.values()],
    subjectAllocations,
    assignments: assignments.map((a) => ({
      id: a._id,
      title: a.title,
      type: a.type,
      dueDate: a.dueDate,
      sectionName: a.sectionId?.name ?? null,
      createdAt: a.createdAt,
    })),
  };
}

// getStudentById: the student + their placement and coursework.
//   class / section : their placement, resolved to human labels
//   subjects        : taught to their section (with the teacher of each)
//   assignments     : everything assigned to their section, with this student's
//                     submission state (pending | submitted | graded) folded in
//   submissions     : the rows this student has actually filed
async function getStudentById(id, auth) {
  ensureFound(id, 'Student');
  const schoolId = auth.schoolId;
  const student = await User.findOne({ _id: id, schoolId, role: USER_ROLES.STUDENT, ...notDeleted });
  if (!student) throw ApiError.notFound('Student not found');

  // TEACHER read-scoping (CHANGE 6): a teacher may only view a student who is in
  // a section they actually teach. We treat "not in your section" as a 404 (same
  // as "doesn't exist") so the endpoint never confirms a student outside the
  // teacher's reach. A principal sees any student in their school.
  if (auth.role === USER_ROLES.TEACHER) {
    const taughtSectionIds = await SubjectAllocation.find({ teacherId: auth.userId, schoolId, ...notDeleted })
      .distinct('sectionId');
    const teaches = taughtSectionIds.some((sid) => String(sid) === String(student.sectionId));
    if (!teaches) throw ApiError.notFound('Student not found');
  }

  const sectionId = student.sectionId;

  const [cls, section, teaching, assignments] = await Promise.all([
    student.classId ? Class.findOne({ _id: student.classId, ...notDeleted }).select('level').lean() : null,
    sectionId ? Section.findOne({ _id: sectionId, ...notDeleted }).select('name').lean() : null,
    sectionId
      ? SubjectAllocation.find({ sectionId, schoolId, ...notDeleted })
          .populate('subjectId', 'name code')
          .populate('teacherId', 'name email')
          .lean()
      : [],
    sectionId
      ? Assignment.find({ sectionId, schoolId, ...notDeleted })
          .sort({ createdAt: -1 })
          .populate({ path: 'subjectAllocationId', select: 'subjectId', populate: { path: 'subjectId', select: 'name' } })
          .select('title type dueDate subjectAllocationId createdAt')
          .lean()
      : [],
  ]);

  const assignmentIds = assignments.map((a) => a._id);
  const submissions = assignmentIds.length
    ? await Submission.find({ studentId: id, assignmentId: { $in: assignmentIds }, ...notDeleted })
        .select('assignmentId status grade feedback submittedAt gradedAt')
        .lean()
    : [];

  const subByAssignment = new Map(submissions.map((s) => [String(s.assignmentId), s]));

  return {
    ...student.toJSON(),
    class: cls ? { id: cls._id, level: cls.level } : null,
    section: section ? { id: section._id, name: section.name } : null,
    subjects: teaching.map((t) => ({
      id: t.subjectId?._id ?? null,
      name: t.subjectId?.name ?? null,
      code: t.subjectId?.code ?? null,
      teacher: t.teacherId ? { id: t.teacherId._id, name: t.teacherId.name } : null,
    })),
    assignments: assignments.map((a) => {
      const sub = subByAssignment.get(String(a._id));
      return {
        id: a._id,
        title: a.title,
        type: a.type,
        dueDate: a.dueDate,
        subjectName: a.subjectAllocationId?.subjectId?.name ?? null,
        hasSubmitted: !!sub,
        status: sub?.status ?? SUBMISSION_STATUS.PENDING,
        grade: sub?.grade ?? null,
        createdAt: a.createdAt,
      };
    }),
    submissions: submissions.map((s) => ({
      id: s._id,
      assignmentId: s.assignmentId,
      status: s.status,
      grade: s.grade,
      feedback: s.feedback,
      submittedAt: s.submittedAt,
      gradedAt: s.gradedAt,
    })),
  };
}

module.exports = {
  createUser,
  listUsers,
  listTeachers,
  listStudents,
  getUserById,
  getTeacherById,
  getStudentById,
  updateUser,
  deleteUser,
};