// Routes for the section module. Mounted at BOTH:
//   /api/sections                       (principal acts on their OWN school)
//   /api/schools/:schoolId/sections     (super-admin targets a school explicitly)
// resolveSchoolScope picks the right schoolId for each caller. Reads open to any
// authenticated user in the school; writes restricted to the PRINCIPAL (own
// school) or SUPER_ADMIN (targeted school). mergeParams lets the nested mount
// see :schoolId.
const { Router } = require('express');
const controller = require('./section.controller');
const validate = require('../../middlewares/validate');
const { requireAuth, requireRole } = require('../../middlewares/auth');
const resolveSchoolScope = require('../../middlewares/resolveSchoolScope');
const { USER_ROLES } = require('../../constant/constant');
const { validateCreateSection, validateUpdateSection } = require('./section.validation');

const router = Router({ mergeParams: true });

router.use(requireAuth, resolveSchoolScope);

router.get('/', controller.list);
router.get('/:id', controller.getOne);

router.post('/', requireRole(USER_ROLES.PRINCIPAL, USER_ROLES.SUPER_ADMIN), validate(validateCreateSection), controller.create);
router.put('/:id', requireRole(USER_ROLES.PRINCIPAL, USER_ROLES.SUPER_ADMIN), validate(validateUpdateSection), controller.update);
router.delete('/:id', requireRole(USER_ROLES.PRINCIPAL, USER_ROLES.SUPER_ADMIN), controller.remove);

module.exports = router;
