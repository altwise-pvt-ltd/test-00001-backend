// Routes for subject allocations. Listing is open to any authenticated user
// (teachers use ?teacherId to see their own); creating/removing the authority
// is a PRINCIPAL action. No update — change an allocation by deleting and
// recreating it.
const { Router } = require('express');
const controller = require('./subjectAllocation.controller');
const validate = require('../../middlewares/validate');
const { requireAuth, requireRole } = require('../../middlewares/auth');
const { USER_ROLES } = require('../../constant/constant');
const { validateCreateSubjectAllocation } = require('./subjectAllocation.validation');

const router = Router();

router.use(requireAuth);

router.get('/', controller.list);

router.post('/', requireRole(USER_ROLES.PRINCIPAL), validate(validateCreateSubjectAllocation), controller.create);
router.delete('/:id', requireRole(USER_ROLES.PRINCIPAL), controller.remove);

module.exports = router;
