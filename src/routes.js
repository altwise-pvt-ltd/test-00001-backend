// Central API router. Mounts every feature module under /api.
// Add new modules here as the app grows.
const { Router } = require('express');
const userRoutes = require('./modules/users/user.routes');
const authRoutes = require('./modules/auth/auth.routes');
const schoolRoutes = require('./modules/schools/school.routes');
const principalRoutes = require('./modules/principals/principal.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const classRoutes = require('./modules/class/class.routes');
const sectionRoutes = require('./modules/section/section.routes');
const subjectRoutes = require('./modules/subject/subject.routes');
const subjectAllocationRoutes = require('./modules/subjectAllocation/subjectAllocation.routes');
const assignmentRoutes = require('./modules/assignment/assignment.routes');
const submissionRoutes = require('./modules/submission/submission.routes');
const homeRoutes = require('./modules/home/home.routes');

const router = Router();

router.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', uptime: process.uptime() });
});

router.use('/auth', authRoutes);

// Platform-level (super-admin only). Each module also asserts requireAuth +
// requireRole('super-admin') internally; these sit above the tenant boundary.
router.use('/admin', adminRoutes);
router.use('/principals', principalRoutes);

// ADMIN-targeted, school-nested management of subjects/classes/sections. These
// MUST be registered BEFORE '/schools' so '/schools/:schoolId/<resource>' is
// matched here and not swallowed by the schools router. The same routers also
// serve the principal at the top-level mounts below (own school); each picks the
// right schoolId via resolveSchoolScope.
router.use('/schools/:schoolId/subjects', subjectRoutes);
router.use('/schools/:schoolId/classes', classRoutes);
router.use('/schools/:schoolId/sections', sectionRoutes);
router.use('/schools', schoolRoutes);

router.use('/users', userRoutes);
router.use('/classes', classRoutes);
router.use('/sections', sectionRoutes);
router.use('/subjects', subjectRoutes);
router.use('/subject-allocations', subjectAllocationRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/submissions', submissionRoutes);
router.use('/home', homeRoutes);

module.exports = router;
