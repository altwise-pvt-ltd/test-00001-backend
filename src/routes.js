// Central API router. Mounts every feature module under /api.
// Add new modules here as the app grows.
const { Router } = require('express');
const userRoutes = require('./modules/users/user.routes');
const authRoutes = require('./modules/auth/auth.routes');
const classRoutes = require('./modules/class/class.routes');
const sectionRoutes = require('./modules/section/section.routes');
const subjectRoutes = require('./modules/subject/subject.routes');
const teachingAssignmentRoutes = require('./modules/assignment/teachingAssignment.routes');
const assignmentRoutes = require('./modules/assignment/assignment.routes');
const submissionRoutes = require('./modules/submission/submission.routes');
const homeRoutes = require('./modules/home/home.routes');

const router = Router();

router.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', uptime: process.uptime() });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/classes', classRoutes);
router.use('/sections', sectionRoutes);
router.use('/subjects', subjectRoutes);
router.use('/teaching-assignments', teachingAssignmentRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/submissions', submissionRoutes);
router.use('/home', homeRoutes);

module.exports = router;
