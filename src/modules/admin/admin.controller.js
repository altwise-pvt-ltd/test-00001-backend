// HTTP layer for the admin cross-school overview.
const asyncHandler = require('../../utils/asyncHandler');
const adminService = require('./admin.service');

const overview = asyncHandler(async (req, res) => {
  const data = await adminService.getOverview();
  res.json({ success: true, data });
});

module.exports = { overview };
