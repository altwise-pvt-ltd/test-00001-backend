// Routes for teaching assignments. Listing is open to any authenticated user
// (teachers use ?teacherId to see their own); creating/removing the authority
// is a PRINCIPAL action. No update — change an assignment by deleting and
// recreating it.
const { Router } = require('express');
const controller = require('./teachingAssignment.controller');
const validate = require('../../middlewares/validate');
const { requireAuth, requireRole } = require('../../middlewares/auth');
const { USER_ROLES } = require('../../constant/constant');
const { validateCreateTeachingAssignment } = require('./teachingAssignment.validation');

const router = Router();

router.use(requireAuth);

router.get('/', controller.list);

router.post('/', requireRole(USER_ROLES.PRINCIPAL), validate(validateCreateTeachingAssignment), controller.create);
router.delete('/:id', requireRole(USER_ROLES.PRINCIPAL), controller.remove);

module.exports = router;
