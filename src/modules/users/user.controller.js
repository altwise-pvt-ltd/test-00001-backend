// HTTP layer for users: parse request, call service, shape response.
// No business logic here.
const asyncHandler = require('../../utils/asyncHandler');
const userService = require('./user.service');
const subjectAllocationService = require('../subjectAllocation/subjectAllocation.service');

const list = asyncHandler(async (req, res) => {
  const users = await userService.listUsers(req.auth.schoolId);
  res.json({ success: true, data: users });
});

// Principal-only directory lists, trimmed to table columns (see userService).
const listTeachers = asyncHandler(async (req, res) => {
  const teachers = await userService.listTeachers(req.auth.schoolId);
  res.json({ success: true, data: teachers });
});

const listStudents = asyncHandler(async (req, res) => {
  // Scoped in the service by role: principal -> whole school; teacher -> only
  // students in sections they teach.
  const students = await userService.listStudents(req.auth);
  res.json({ success: true, data: students });
});

const getOne = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id, req.auth.schoolId);
  res.json({ success: true, data: user });
});

// Detail views: the user PLUS their related world (classes, sections, subjects,
// assignments, submissions). See userService for the exact shape per role.
const getTeacher = asyncHandler(async (req, res) => {
  const teacher = await userService.getTeacherById(req.params.id, req.auth.schoolId);
  res.json({ success: true, data: teacher });
});

const getStudent = asyncHandler(async (req, res) => {
  // Scoped in the service by role: a teacher may only view students in sections
  // they teach (404 otherwise); a principal sees any student in their school.
  const student = await userService.getStudentById(req.params.id, req.auth);
  res.json({ success: true, data: student });
});

// Principal-only: replace a teacher's set of subjects/sections (subject
// allocations). Body: { subjectAllocations: [{ subjectId, sectionId }, ...] }.
// Returns the refreshed teacher detail so the client sees the new subjects/classes.
const updateTeacherTeaching = asyncHandler(async (req, res) => {
  const summary = await subjectAllocationService.syncTeacherAllocations(
    req.auth.schoolId,
    req.params.id,
    req.body.subjectAllocations,
    req.auth.userId
  );
  const teacher = await userService.getTeacherById(req.params.id, req.auth.schoolId);
  res.json({ success: true, data: teacher, meta: summary });
});

const create = asyncHandler(async (req, res) => {
  // The service derives schoolId/authority from the creator (req.auth), never
  // the body. It returns { user, initialPassword } — surface both once.
  const { user, initialPassword } = await userService.createUser(req.auth, req.body);
  res.status(201).json({ success: true, data: { user, initialPassword } });
});

const update = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.auth.schoolId, req.body);
  res.json({ success: true, data: user });
});

const remove = asyncHandler(async (req, res) => {
  await userService.deleteUser(req.params.id, req.auth.schoolId);
  res.status(204).send();
});

module.exports = {
  list,
  listTeachers,
  listStudents,
  getOne,
  getTeacher,
  getStudent,
  updateTeacherTeaching,
  create,
  update,
  remove,
};
