// Route table for the users module. Maps URLs to controller handlers and
// attaches per-route middleware (auth, role gating, validation, etc.).
//
// Every route requires a valid session (requireAuth) and is tenant-scoped in
// the service layer by req.auth.schoolId. Creating/updating/deleting users is
// restricted to the PRINCIPAL of the school.
const { Router } = require('express');
const controller = require('./user.controller');
const validate = require('../../middlewares/validate');
const { requireAuth, requireRole } = require('../../middlewares/auth');
const { USER_ROLES } = require('../../constant/constant');
const {
  validateCreateUser,
  validateUpdateUser,
  validateSetTeacherTeaching,
} = require('./user.validation');

const router = Router();

// All user routes require authentication.
router.use(requireAuth);

router.get('/', controller.list);

// Principal-only directory lists (trimmed to table columns). Placed before the
// '/teachers/:id' / '/students/:id' detail routes — exact paths, no conflict.
router.get('/teachers', requireRole(USER_ROLES.PRINCIPAL), controller.listTeachers);
router.get('/students', requireRole(USER_ROLES.PRINCIPAL), controller.listStudents);

// Detail views with related data (placed before '/:id' so the literal
// 'teachers'/'students' segments are not swallowed by the :id param).
router.get('/teachers/:id', controller.getTeacher);
router.get('/students/:id', controller.getStudent);

// Principal manages a teacher's subjects/sections — i.e. their TeachingAssignments
// (teacher × subject × section), the single source of truth for the teacher↔section
// relation. Sends the full desired set; the service diffs it (add/revive/remove).
// Restricted to the school's PRINCIPAL.
router.put(
  '/teachers/:id/teaching',
  requireRole(USER_ROLES.PRINCIPAL),
  validate(validateSetTeacherTeaching),
  controller.updateTeacherTeaching
);

router.get('/:id', controller.getOne);

// Create: a principal may create a teacher or student; a teacher may create a
// student in their OWN section only. The authority + own-section rules are
// enforced in the service (it has req.auth and can read the teacher's section).
router.post(
  '/',
  requireRole(USER_ROLES.PRINCIPAL, USER_ROLES.TEACHER),
  validate(validateCreateUser),
  controller.create
);
// Update/delete remain principal-only.
router.put('/:id', requireRole(USER_ROLES.PRINCIPAL), validate(validateUpdateUser), controller.update);
router.delete('/:id', requireRole(USER_ROLES.PRINCIPAL), controller.remove);

module.exports = router;
