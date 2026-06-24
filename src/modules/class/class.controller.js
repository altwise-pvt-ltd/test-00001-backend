// HTTP layer for classes: parse request, call service, shape response.
// req.schoolId is set by resolveSchoolScope — the principal's own school, or the
// school the admin targeted via /api/schools/:schoolId/classes.
const asyncHandler = require('../../utils/asyncHandler');
const classService = require('./class.service');

const list = asyncHandler(async (req, res) => {
  const items = await classService.listClasses(req.schoolId);
  res.json({ success: true, data: items });
});

const getOne = asyncHandler(async (req, res) => {
  const item = await classService.getClassById(req.params.id, req.schoolId);
  res.json({ success: true, data: item });
});

// Principal-only detail view: roster + subjects/teachers + assignments + submissions.
const getDetail = asyncHandler(async (req, res) => {
  const item = await classService.getClassDetail(req.params.id, req.schoolId);
  res.json({ success: true, data: item });
});

const create = asyncHandler(async (req, res) => {
  const item = await classService.createClass(req.schoolId, req.body, req.auth.userId);
  res.status(201).json({ success: true, data: item });
});

const update = asyncHandler(async (req, res) => {
  const item = await classService.updateClass(req.params.id, req.schoolId, req.body, req.auth.userId);
  res.json({ success: true, data: item });
});

const remove = asyncHandler(async (req, res) => {
  await classService.deleteClass(req.params.id, req.schoolId, req.auth.userId);
  res.status(204).send();
});

module.exports = { list, getOne, getDetail, create, update, remove };
