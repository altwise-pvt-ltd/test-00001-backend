// Routes for the principals module. ENTIRELY super-admin only: principals are a
// platform-level resource managed from above the tenant boundary. Gating is
// applied at mount time in src/routes.js (requireAuth + requireRole super-admin),
// and reasserted here so the module is safe if mounted elsewhere.
const { Router } = require('express');
const controller = require('./principal.controller');
const validate = require('../../middlewares/validate');
const { requireAuth, requireRole } = require('../../middlewares/auth');
const { USER_ROLES } = require('../../constant/constant');
const { validateCreatePrincipal } = require('./principal.validation');

const router = Router();

router.use(requireAuth, requireRole(USER_ROLES.SUPER_ADMIN));

router.get('/', controller.list);
router.post('/', validate(validateCreatePrincipal), controller.create);

module.exports = router;
