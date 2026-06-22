// Routes for the class module. Reads are open to any authenticated user in the
// school; create/update/delete are restricted to the PRINCIPAL. Tenant scoping
// is enforced in the service via req.auth.schoolId.
const { Router } = require('express');
const controller = require('./class.controller');
const validate = require('../../middlewares/validate');
const { requireAuth, requireRole } = require('../../middlewares/auth');
const { USER_ROLES } = require('../../constant/constant');
const { validateCreateClass, validateUpdateClass } = require('./class.validation');

const router = Router();

router.use(requireAuth);

router.get('/', controller.list);

// Full class detail (roster, subjects/teachers, assignments, submissions) —
// PRINCIPAL only. Two-segment path, so it does not collide with '/:id'.
router.get('/:id/detail', requireRole(USER_ROLES.PRINCIPAL), controller.getDetail);

router.get('/:id', controller.getOne);

router.post('/', requireRole(USER_ROLES.PRINCIPAL), validate(validateCreateClass), controller.create);
router.put('/:id', requireRole(USER_ROLES.PRINCIPAL), validate(validateUpdateClass), controller.update);
router.delete('/:id', requireRole(USER_ROLES.PRINCIPAL), controller.remove);

module.exports = router;
