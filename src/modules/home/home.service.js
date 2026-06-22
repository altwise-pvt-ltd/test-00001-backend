const User = require('../users/user.model');
const School = require('../../models/School');
const Class = require('../class/class.model');
const Section = require('../section/section.model');
const Subject = require('../subject/subject.model');
const TeachingAssignment = require('../assignment/teachingAssignment.model');
const Assignment = require('../assignment/assignment.model');
const Submission = require('../submission/submission.model');
const { USER_ROLES, SUBMISSION_STATUS } = require('../../constant/constant');

const UPCOMING_WINDOW_DAYS = 14;
const RECENT_LIMIT = 5;

// helper: { $gte: now, $lte: now + 14d } window for due dates
function upcomingWindow() {
  const now = new Date();
  const end = new Date(now.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return { now, end };
}

// "active" filter applied everywhere: not soft-deleted
const notDeleted = { deletedAt: null };

// ---------------------------------------------------------------------------
// PRINCIPAL: school-wide overview
// ---------------------------------------------------------------------------
async function buildPrincipalHome(user) {
  const schoolId = user.schoolId;

  const [
    school,
    teachers,
    students,
    classes,
    sections,
    subjects,
    recentAssignments,
    recentSubmissions,
  ] = await Promise.all([
    School.findOne({ _id: schoolId, ...notDeleted }).select('name').lean(),
    User.countDocuments({ schoolId, role: USER_ROLES.TEACHER, ...notDeleted }),
    User.countDocuments({ schoolId, role: USER_ROLES.STUDENT, ...notDeleted }),
    Class.countDocuments({ schoolId, ...notDeleted }),
    Section.countDocuments({ schoolId, ...notDeleted }),
    Subject.countDocuments({ schoolId, ...notDeleted }),
    Assignment.find({ schoolId, ...notDeleted })
      .sort({ createdAt: -1 })
      .limit(RECENT_LIMIT)
      .populate('sectionId', 'name')
      .populate('createdBy', 'name')
      .select('title sectionId createdBy createdAt')
      .lean(),
    Submission.find({ schoolId, ...notDeleted })
      .sort({ submittedAt: -1 })
      .limit(RECENT_LIMIT)
      .populate('studentId', 'name')
      .populate('assignmentId', 'title')
      .select('studentId assignmentId status submittedAt')
      .lean(),
  ]);

  return {
    role: USER_ROLES.PRINCIPAL,
    school: school ? { id: school._id, name: school.name } : null,
    counts: { teachers, students, classes, sections, subjects },
    recent: {
      assignments: recentAssignments.map((a) => ({
        id: a._id,
        title: a.title,
        sectionName: a.sectionId?.name ?? null,
        teacherName: a.createdBy?.name ?? null,
        createdAt: a.createdAt,
      })),
      submissions: recentSubmissions.map((s) => ({
        id: s._id,
        studentName: s.studentId?.name ?? null,
        assignmentTitle: s.assignmentId?.title ?? null,
        status: s.status,
        submittedAt: s.submittedAt,
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// TEACHER: their teaching world
// ---------------------------------------------------------------------------
async function buildTeacherHome(user) {
  const schoolId = user.schoolId;
  const teacherId = user._id;
  const { now, end } = upcomingWindow();

  // teaching assignments first — we need their ids to scope the rest
  const teaching = await TeachingAssignment.find({ teacherId, schoolId, ...notDeleted })
    .populate('subjectId', 'name')
    .populate({ path: 'sectionId', select: 'name classId', populate: { path: 'classId', select: 'level' } })
    .lean();

  const taIds = teaching.map((t) => t._id);

  // ids of this teacher's own assignments — scopes both the to-grade count and
  // the to-grade list, so the list is capped to THIS teacher's submissions
  // rather than the school-wide 5 oldest (which could exclude them entirely).
  const myAssignmentIds = await Assignment.find({
    teachingAssignmentId: { $in: taIds },
    schoolId,
    ...notDeleted,
  }).distinct('_id');

  const [assignmentsCreated, submissionsToGradeCount, recentAssignments, myToGrade, upcoming] =
    await Promise.all([
      Assignment.countDocuments({ teachingAssignmentId: { $in: taIds }, schoolId, ...notDeleted }),
      Submission.countDocuments({
        schoolId,
        status: SUBMISSION_STATUS.SUBMITTED,
        assignmentId: { $in: myAssignmentIds },
        ...notDeleted,
      }),
      Assignment.find({ teachingAssignmentId: { $in: taIds }, schoolId, ...notDeleted })
        .sort({ createdAt: -1 })
        .limit(RECENT_LIMIT)
        .populate('sectionId', 'name')
        .select('title sectionId dueDate createdAt')
        .lean(),
      Submission.find({
        schoolId,
        status: SUBMISSION_STATUS.SUBMITTED,
        assignmentId: { $in: myAssignmentIds },
        ...notDeleted,
      })
        .sort({ submittedAt: 1 }) // OLDEST first — longest waiting to grade
        .limit(RECENT_LIMIT)
        .populate('studentId', 'name')
        .populate('assignmentId', 'title')
        .lean(),
      Assignment.find({
        teachingAssignmentId: { $in: taIds },
        schoolId,
        dueDate: { $gte: now, $lte: end },
        ...notDeleted,
      })
        .sort({ dueDate: 1 })
        .populate('sectionId', 'name')
        .select('title sectionId dueDate')
        .lean(),
    ]);

  return {
    role: USER_ROLES.TEACHER,
    teaching: teaching.map((t) => ({
      teachingAssignmentId: t._id,
      subjectName: t.subjectId?.name ?? null,
      className: t.sectionId?.classId?.level != null ? `Class ${t.sectionId.classId.level}` : null,
      sectionName: t.sectionId?.name ?? null,
    })),
    counts: {
      assignmentsCreated,
      submissionsToGrade: submissionsToGradeCount,
    },
    recent: {
      assignments: recentAssignments.map((a) => ({
        id: a._id,
        title: a.title,
        sectionName: a.sectionId?.name ?? null,
        dueDate: a.dueDate,
        createdAt: a.createdAt,
      })),
      submissionsToGrade: myToGrade.map((s) => ({
        id: s._id,
        studentName: s.studentId?.name ?? null,
        assignmentTitle: s.assignmentId?.title ?? null,
        submittedAt: s.submittedAt,
      })),
    },
    upcoming: upcoming.map((a) => ({
      assignmentId: a._id,
      title: a.title,
      sectionName: a.sectionId?.name ?? null,
      dueDate: a.dueDate,
    })),
  };
}

// ---------------------------------------------------------------------------
// STUDENT: their work
// ---------------------------------------------------------------------------
async function buildStudentHome(user) {
  const schoolId = user.schoolId;
  const sectionId = user.sectionId;
  const studentId = user._id;
  const { now, end } = upcomingWindow();

  // load placement (class + section names)
  const [section, sectionAssignments] = await Promise.all([
    Section.findOne({ _id: sectionId, ...notDeleted })
      .populate('classId', 'level')
      .select('name classId')
      .lean(),
    Assignment.find({ sectionId, schoolId, ...notDeleted }).select('_id dueDate title').lean(),
  ]);

  const assignmentIds = sectionAssignments.map((a) => a._id);

  // this student's submissions across those assignments
  const mySubmissions = await Submission.find({
    studentId,
    assignmentId: { $in: assignmentIds },
    ...notDeleted,
  })
    .select('assignmentId status grade feedback gradedAt')
    .lean();

  const submittedMap = new Map(mySubmissions.map((s) => [String(s.assignmentId), s]));

  // counts: pending = assigned but no submission; submitted; graded
  let submitted = 0;
  let graded = 0;
  for (const s of mySubmissions) {
    if (s.status === SUBMISSION_STATUS.GRADED) graded += 1;
    else if (s.status === SUBMISSION_STATUS.SUBMITTED) submitted += 1;
  }
  const pending = assignmentIds.length - mySubmissions.length;

  // recent grades (last 5 graded, newest first)
  const recentGrades = mySubmissions
    .filter((s) => s.status === SUBMISSION_STATUS.GRADED && s.gradedAt)
    .sort((a, b) => new Date(b.gradedAt) - new Date(a.gradedAt))
    .slice(0, RECENT_LIMIT);

  // map assignmentId -> title for the grade list
  const titleMap = new Map(sectionAssignments.map((a) => [String(a._id), a.title]));

  // upcoming: due within window, with hasSubmitted flag
  const upcoming = await Assignment.find({
    sectionId,
    schoolId,
    dueDate: { $gte: now, $lte: end },
    ...notDeleted,
  })
    .sort({ dueDate: 1 })
    .populate({ path: 'teachingAssignmentId', select: 'subjectId', populate: { path: 'subjectId', select: 'name' } })
    .select('title dueDate teachingAssignmentId')
    .lean();

  return {
    role: USER_ROLES.STUDENT,
    placement: {
      className: section?.classId?.level != null ? `Class ${section.classId.level}` : null,
      sectionName: section?.name ?? null,
    },
    counts: { pending: Math.max(pending, 0), submitted, graded },
    recent: {
      grades: recentGrades.map((s) => ({
        assignmentTitle: titleMap.get(String(s.assignmentId)) ?? null,
        grade: s.grade,
        feedback: s.feedback,
        gradedAt: s.gradedAt,
      })),
    },
    upcoming: upcoming.map((a) => ({
      assignmentId: a._id,
      title: a.title,
      subjectName: a.teachingAssignmentId?.subjectId?.name ?? null,
      dueDate: a.dueDate,
      hasSubmitted: submittedMap.has(String(a._id)),
    })),
  };
}

// ---------------------------------------------------------------------------
// dispatcher
// ---------------------------------------------------------------------------
async function getHome(user) {
  switch (user.role) {
    case USER_ROLES.PRINCIPAL:
      return buildPrincipalHome(user);
    case USER_ROLES.TEACHER:
      return buildTeacherHome(user);
    case USER_ROLES.STUDENT:
      return buildStudentHome(user);
    default:
      throw new Error(`Unknown role: ${user.role}`);
  }
}

module.exports = { getHome, buildPrincipalHome, buildTeacherHome, buildStudentHome };