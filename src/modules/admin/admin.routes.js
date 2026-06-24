// Routes for the admin module — platform-level oversight, ENTIRELY super-admin
// only. This is a derived read-only rollup (no model/validation slice): it just
// queries existing collections. Gating is applied at mount time in
// src/routes.js and reasserted here so the module is safe if mounted elsewhere.
const { Router } = require('express');
const controller = require('./admin.controller');
const { requireAuth, requireRole } = require('../../middlewares/auth');
const { USER_ROLES } = require('../../constant/constant');

const router = Router();

router.use(requireAuth, requireRole(USER_ROLES.SUPER_ADMIN));

// GET /api/admin/overview — cross-school summary: per-school counts + principal
// + recent activity, newest first.
router.get('/overview', controller.overview);

module.exports = router;
