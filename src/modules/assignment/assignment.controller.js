// HTTP layer for assignments. Reads are role-scoped inside the service via
// req.auth; create is restricted to teachers at the route level.
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./assignment.service');

const list = asyncHandler(async (req, res) => {
  const items = await service.listAssignments(req.auth, { sectionId: req.query.sectionId });
  res.json({ success: true, data: items });
});

const getOne = asyncHandler(async (req, res) => {
  const item = await service.getAssignmentById(req.params.id, req.auth);
  res.json({ success: true, data: item });
});

const create = asyncHandler(async (req, res) => {
  const item = await service.createAssignment(req.auth.schoolId, req.auth.userId, req.body);
  res.status(201).json({ success: true, data: item });
});

const update = asyncHandler(async (req, res) => {
  const item = await service.updateAssignment(req.params.id, req.auth, req.body);
  res.json({ success: true, data: item });
});

const remove = asyncHandler(async (req, res) => {
  await service.deleteAssignment(req.params.id, req.auth);
  res.status(204).send();
});

module.exports = { list, getOne, create, update, remove };
