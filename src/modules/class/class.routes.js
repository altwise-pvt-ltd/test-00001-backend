// Routes for the class module. Mounted at BOTH:
//   /api/classes                       (principal acts on their OWN school)
//   /api/schools/:schoolId/classes     (super-admin targets a school explicitly)
// resolveSchoolScope picks the right schoolId for each caller. Reads are open to
// any authenticated user in the school; create/update/delete are restricted to
// the PRINCIPAL (own school) or SUPER_ADMIN (targeted school). mergeParams lets
// the nested mount see :schoolId.
const { Router } = require('express');
const controller = require('./class.controller');
const validate = require('../../middlewares/validate');
const { requireAuth, requireRole } = require('../../middlewares/auth');
const resolveSchoolScope = require('../../middlewares/resolveSchoolScope');
const { USER_ROLES } = require('../../constant/constant');
const { validateCreateClass, validateUpdateClass } = require('./class.validation');

const router = Router({ mergeParams: true });

router.use(requireAuth, resolveSchoolScope);

router.get('/', controller.list);

// Full class detail (roster, subjects/teachers, assignments, submissions) —
// PRINCIPAL only. Two-segment path, so it does not collide with '/:id'.
router.get('/:id/detail', requireRole(USER_ROLES.PRINCIPAL), controller.getDetail);

router.get('/:id', controller.getOne);

router.post('/', requireRole(USER_ROLES.PRINCIPAL, USER_ROLES.SUPER_ADMIN), validate(validateCreateClass), controller.create);
router.put('/:id', requireRole(USER_ROLES.PRINCIPAL, USER_ROLES.SUPER_ADMIN), validate(validateUpdateClass), controller.update);
router.delete('/:id', requireRole(USER_ROLES.PRINCIPAL, USER_ROLES.SUPER_ADMIN), controller.remove);

module.exports = router;
