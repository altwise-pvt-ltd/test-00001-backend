// HTTP layer for schools: parse request, call service, shape { success, data }.
const asyncHandler = require('../../utils/asyncHandler');
const schoolService = require('./school.service');

const create = asyncHandler(async (req, res) => {
  const school = await schoolService.createSchool(req.body, req.auth.userId);
  res.status(201).json({ success: true, data: school });
});

const list = asyncHandler(async (req, res) => {
  const schools = await schoolService.listSchools();
  res.json({ success: true, data: schools });
});

const getOne = asyncHandler(async (req, res) => {
  const school = await schoolService.getSchoolById(req.params.id);
  res.json({ success: true, data: school });
});

const assignPrincipal = asyncHandler(async (req, res) => {
  const { school, principal } = await schoolService.assignPrincipal(req.params.id, req.body.principalId);
  res.json({ success: true, data: { school, principal } });
});

const unassignPrincipal = asyncHandler(async (req, res) => {
  const result = await schoolService.unassignPrincipal(req.params.id);
  res.json({ success: true, data: result });
});

const activate = asyncHandler(async (req, res) => {
  const school = await schoolService.setActive(req.params.id, true, req.auth.userId);
  res.json({ success: true, data: school });
});

const deactivate = asyncHandler(async (req, res) => {
  const school = await schoolService.setActive(req.params.id, false, req.auth.userId);
  res.json({ success: true, data: school });
});

module.exports = { create, list, getOne, assignPrincipal, unassignPrincipal, activate, deactivate };
