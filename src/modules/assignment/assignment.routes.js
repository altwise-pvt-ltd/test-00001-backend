// Routes for the assignment module.
//  - list/read: any authenticated user (service scopes results by role)
//  - create:    TEACHER only (step 4 — and only within what they teach)
//  - update/delete: the owning teacher (or principal), enforced in the service
const { Router } = require('express');
const controller = require('./assignment.controller');
const validate = require('../../middlewares/validate');
const { requireAuth, requireRole } = require('../../middlewares/auth');
const { USER_ROLES } = require('../../constant/constant');
const { validateCreateAssignment, validateUpdateAssignment } = require('./assignment.validation');

const router = Router();

router.use(requireAuth);

router.get('/', controller.list);
router.get('/:id', controller.getOne);

router.post('/', requireRole(USER_ROLES.TEACHER), validate(validateCreateAssignment), controller.create);
router.put('/:id', requireRole(USER_ROLES.TEACHER, USER_ROLES.PRINCIPAL), validate(validateUpdateAssignment), controller.update);
router.delete('/:id', requireRole(USER_ROLES.TEACHER, USER_ROLES.PRINCIPAL), controller.remove);

module.exports = router;
