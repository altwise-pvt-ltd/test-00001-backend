// Routes for the subject module. Mounted at BOTH:
//   /api/subjects                       (principal acts on their OWN school)
//   /api/schools/:schoolId/subjects     (super-admin targets a school explicitly)
// resolveSchoolScope picks the right schoolId for each caller. Reads are open to
// any authenticated user (scoped to their school); writes are restricted to the
// PRINCIPAL (own school) or SUPER_ADMIN (targeted school). mergeParams lets the
// nested mount see :schoolId.
const { Router } = require('express');
const controller = require('./subject.controller');
const validate = require('../../middlewares/validate');
const { requireAuth, requireRole } = require('../../middlewares/auth');
const resolveSchoolScope = require('../../middlewares/resolveSchoolScope');
const { USER_ROLES } = require('../../constant/constant');
const { validateCreateSubject, validateUpdateSubject } = require('./subject.validation');

const router = Router({ mergeParams: true });

router.use(requireAuth, resolveSchoolScope);

router.get('/', controller.list);
router.get('/:id', controller.getOne);

router.post('/', requireRole(USER_ROLES.PRINCIPAL, USER_ROLES.SUPER_ADMIN), validate(validateCreateSubject), controller.create);
router.put('/:id', requireRole(USER_ROLES.PRINCIPAL, USER_ROLES.SUPER_ADMIN), validate(validateUpdateSubject), controller.update);
router.delete('/:id', requireRole(USER_ROLES.PRINCIPAL, USER_ROLES.SUPER_ADMIN), controller.remove);

module.exports = router;
