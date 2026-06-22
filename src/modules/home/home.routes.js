// Route for the role-aware dashboard. Any authenticated user; the service
// returns a different shape per role (principal / teacher / student).
const { Router } = require('express');
const controller = require('./home.controller');
const { requireAuth } = require('../../middlewares/auth');

const router = Router();

router.use(requireAuth);

// GET /api/home
router.get('/', controller.getHome);

module.exports = router;
