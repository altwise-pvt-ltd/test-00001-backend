// Admin cross-school overview — the "what's happening across the schools I
// oversee" view for the super-admin. Built ENTIRELY by querying existing
// collections (no audit/event table): per-school counts plus a recent-activity
// feed derived from existing createdBy/createdAt stamps. Names are populated so
// nothing returns a bare ObjectId.
const School = require('../../models/School');
const User = require('../users/user.model');
const Class = require('../class/class.model');
const Section = require('../section/section.model');
const Subject = require('../subject/subject.model');
const Assignment = require('../assignment/assignment.model');
const Submission = require('../submission/submission.model');
const { USER_ROLES } = require('../../constant/constant');

const notDeleted = { deletedAt: null };

// How many recent-activity lines to keep per school in the rollup.
const RECENT_PER_SCHOOL = 10;
// Best-effort cap pulled from each source collection before grouping. This is a
// derived rollup, not an exhaustive audit log — if a single school is extremely
// active it may crowd the global window; acceptable for an oversight summary.
const ACTIVITY_FETCH = 300;

// Grouped count keyed by schoolId -> Map<schoolIdString, number>. One grouped
// query per collection (not one per school) keeps the rollup cheap.
async function countBySchool(Model, match = {}) {
  const rows = await Model.aggregate([
    { $match: { deletedAt: null, ...match } },
    { $group: { _id: '$schoolId', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

// Recent activity per school, newest first, derived from existing records:
//   - a user being created      -> "<creator> added <role> <name>"
//   - an assignment being made  -> "<teacher> created assignment \"<title>\""
//   - a submission being filed  -> "<student> submitted to \"<assignment>\""
async function buildRecentActivity(schoolIds) {
  const [users, assignments, submissions] = await Promise.all([
    User.find({ schoolId: { $in: schoolIds }, role: { $in: [USER_ROLES.TEACHER, USER_ROLES.STUDENT] }, ...notDeleted })
      .sort({ createdAt: -1 })
      .limit(ACTIVITY_FETCH)
      .select('name role schoolId createdBy createdAt')
      .populate('createdBy', 'name role')
      .lean(),
    Assignment.find({ schoolId: { $in: schoolIds }, ...notDeleted })
      .sort({ createdAt: -1 })
      .limit(ACTIVITY_FETCH)
      .select('title schoolId createdBy createdAt')
      .populate('createdBy', 'name role')
      .lean(),
    Submission.find({ schoolId: { $in: schoolIds }, ...notDeleted })
      .sort({ createdAt: -1 })
      .limit(ACTIVITY_FETCH)
      .select('schoolId studentId assignmentId createdAt')
      .populate('studentId', 'name')
      .populate('assignmentId', 'title')
      .lean(),
  ]);

  const events = [];
  for (const u of users) {
    events.push({
      schoolId: String(u.schoolId),
      type: 'user_created',
      at: u.createdAt,
      message: `${u.createdBy?.name ?? 'Someone'} added ${u.role} ${u.name}`,
    });
  }
  for (const a of assignments) {
    events.push({
      schoolId: String(a.schoolId),
      type: 'assignment_created',
      at: a.createdAt,
      message: `${a.createdBy?.name ?? 'A teacher'} created assignment "${a.title}"`,
    });
  }
  for (const s of submissions) {
    events.push({
      schoolId: String(s.schoolId),
      type: 'submission_created',
      at: s.createdAt,
      message: `${s.studentId?.name ?? 'A student'} submitted to "${s.assignmentId?.title ?? 'an assignment'}"`,
    });
  }

  events.sort((a, b) => new Date(b.at) - new Date(a.at));

  const bySchool = new Map();
  for (const e of events) {
    const list = bySchool.get(e.schoolId) || [];
    if (list.length >= RECENT_PER_SCHOOL) continue;
    list.push(e);
    bySchool.set(e.schoolId, list);
  }
  return bySchool;
}

// Platform-wide overview: every school with its principal, counts and recent
// activity. Soft-deleted schools are excluded.
async function getOverview() {
  const schools = await School.find({ ...notDeleted }).sort({ createdAt: -1 }).lean();
  const schoolIds = schools.map((s) => s._id);

  if (schoolIds.length === 0) return { schools: [] };

  const principals = await User.find({ role: USER_ROLES.PRINCIPAL, schoolId: { $in: schoolIds }, ...notDeleted })
    .select('name email schoolId')
    .lean();
  const principalBySchool = new Map(principals.map((p) => [String(p.schoolId), p]));

  const [teachers, students, classes, sections, subjects, assignments, submissions, activityBySchool] =
    await Promise.all([
      countBySchool(User, { role: USER_ROLES.TEACHER }),
      countBySchool(User, { role: USER_ROLES.STUDENT }),
      countBySchool(Class),
      countBySchool(Section),
      countBySchool(Subject),
      countBySchool(Assignment),
      countBySchool(Submission),
      buildRecentActivity(schoolIds),
    ]);

  const schoolsOut = schools.map((s) => {
    const id = String(s._id);
    const principal = principalBySchool.get(id);
    return {
      id: s._id,
      name: s.name,
      isActive: s.isActive,
      principal: principal ? { id: principal._id, name: principal.name, email: principal.email } : null,
      counts: {
        teachers: teachers.get(id) || 0,
        students: students.get(id) || 0,
        classes: classes.get(id) || 0,
        sections: sections.get(id) || 0,
        subjects: subjects.get(id) || 0,
        assignments: assignments.get(id) || 0,
        submissions: submissions.get(id) || 0,
      },
      recentActivity: activityBySchool.get(id) || [],
    };
  });

  return { schools: schoolsOut };
}

module.exports = { getOverview };
