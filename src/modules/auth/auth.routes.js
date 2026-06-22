// Auth routes.
//   Public:    register, login, refresh (refresh reads the httpOnly cookie).
//   Protected: me, logout, logout-all.
const { Router } = require('express');
const controller = require('./auth.controller');
const validate = require('../../middlewares/validate');
const { requireAuth } = require('../../middlewares/auth');
const { validateRegister, validateLogin } = require('./auth.validation');

const router = Router();

router.post('/register', validate(validateRegister), controller.register);
router.post('/login', validate(validateLogin), controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', requireAuth, controller.logout);
router.get('/me', requireAuth, controller.me);
router.post('/logout-all', requireAuth, controller.logoutAll);

module.exports = router;
