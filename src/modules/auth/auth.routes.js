// Auth routes.
//   Public:    login, refresh (refresh reads the httpOnly cookie).
//   Protected: me, logout, logout-all.
//
// Public self-registration was REMOVED: there is no longer a way to sign up a
// school + principal over HTTP. Schools are provisioned by a super-admin
// (POST /api/schools), principals are created by a super-admin
// (POST /api/principals), and the very first super-admin is bootstrapped out of
// band via src/scripts/createAdmin.js.
const { Router } = require('express');
const controller = require('./auth.controller');
const validate = require('../../middlewares/validate');
const { requireAuth } = require('../../middlewares/auth');
const { validateLogin } = require('./auth.validation');

const router = Router();

router.post('/login', validate(validateLogin), controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', requireAuth, controller.logout);
router.get('/me', requireAuth, controller.me);
router.post('/logout-all', requireAuth, controller.logoutAll);

module.exports = router;
