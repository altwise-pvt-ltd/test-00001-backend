// Routes for the section module. Reads open to any authenticated user; writes
// restricted to the PRINCIPAL. Tenant scoping enforced in the service.
const { Router } = require('express');
const controller = require('./section.controller');
const validate = require('../../middlewares/validate');
const { requireAuth, requireRole } = require('../../middlewares/auth');
const { USER_ROLES } = require('../../constant/constant');
const { validateCreateSection, validateUpdateSection } = require('./section.validation');

const router = Router();

router.use(requireAuth);

router.get('/', controller.list);
router.get('/:id', controller.getOne);

router.post('/', requireRole(USER_ROLES.PRINCIPAL), validate(validateCreateSection), controller.create);
router.put('/:id', requireRole(USER_ROLES.PRINCIPAL), validate(validateUpdateSection), controller.update);
router.delete('/:id', requireRole(USER_ROLES.PRINCIPAL), controller.remove);

module.exports = router;
