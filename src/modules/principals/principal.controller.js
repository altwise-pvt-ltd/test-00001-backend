// HTTP layer for principals: parse request, call service, shape { success, data }.
const asyncHandler = require('../../utils/asyncHandler');
const principalService = require('./principal.service');

const create = asyncHandler(async (req, res) => {
  const principal = await principalService.createPrincipal(req.body, req.auth.userId);
  // toJSON transform strips passwordHash/tokenVersion/__v.
  res.status(201).json({ success: true, data: principal });
});

const list = asyncHandler(async (req, res) => {
  const principals = await principalService.listPrincipals();
  res.json({ success: true, data: principals });
});

module.exports = { create, list };
