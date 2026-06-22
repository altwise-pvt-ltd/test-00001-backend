// Routes for the submission module.
//  - list/read: any authenticated user (service scopes by role)
//  - create:    STUDENT only (step 6) — body carries assignmentId
//  - grade:     TEACHER only (step 7) — must teach the assignment
const { Router } = require('express');
const controller = require('./submission.controller');
const validate = require('../../middlewares/validate');
const { requireAuth, requireRole } = require('../../middlewares/auth');
const { USER_ROLES } = require('../../constant/constant');
const { validateCreateSubmission, validateGrade } = require('./submission.validation');

const router = Router();

router.use(requireAuth);

router.get('/', controller.list);
router.get('/:id', controller.getOne);

router.post('/', requireRole(USER_ROLES.STUDENT), validate(validateCreateSubmission), controller.create);
router.patch('/:id/grade', requireRole(USER_ROLES.TEACHER), validate(validateGrade), controller.grade);

module.exports = router;
