// Routes for the schools module. ENTIRELY super-admin only: schools are
// provisioned and overseen from above the per-school tenant boundary. Gating is
// applied at mount time in src/routes.js (requireAuth + requireRole super-admin),
// and reasserted here so the module is safe if mounted elsewhere.
const { Router } = require('express');
const controller = require('./school.controller');
const validate = require('../../middlewares/validate');
const { requireAuth, requireRole } = require('../../middlewares/auth');
const { USER_ROLES } = require('../../constant/constant');
const { validateCreateSchool, validateAssignPrincipal } = require('./school.validation');

const router = Router();

router.use(requireAuth, requireRole(USER_ROLES.SUPER_ADMIN));

router.get('/', controller.list);
router.post('/', validate(validateCreateSchool), controller.create);
router.get('/:id', controller.getOne);

// Principal assignment (separate from school creation).
router.patch('/:id/principal', validate(validateAssignPrincipal), controller.assignPrincipal);
router.delete('/:id/principal', controller.unassignPrincipal);

// Lifecycle.
router.patch('/:id/activate', controller.activate);
router.patch('/:id/deactivate', controller.deactivate);

module.exports = router;
