// HTTP layer for the role-aware dashboard.
const asyncHandler = require('../../utils/asyncHandler');
const homeService = require('./home.service');

// GET /api/home
// requireAuth populates req.user with the full user document
// ({ _id, role, schoolId, sectionId? }).
const getHome = asyncHandler(async (req, res) => {
  const data = await homeService.getHome(req.user);
  res.json({ success: true, data });
});

module.exports = { getHome };
