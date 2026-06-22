// HTTP layer for subjects: parse request, call service, shape response.
const asyncHandler = require('../../utils/asyncHandler');
const subjectService = require('./subject.service');

const list = asyncHandler(async (req, res) => {
  const items = await subjectService.listSubjects(req.auth.schoolId);
  res.json({ success: true, data: items });
});

const getOne = asyncHandler(async (req, res) => {
  const item = await subjectService.getSubjectById(req.params.id, req.auth.schoolId);
  res.json({ success: true, data: item });
});

const create = asyncHandler(async (req, res) => {
  const item = await subjectService.createSubject(req.auth.schoolId, req.body, req.auth.userId);
  res.status(201).json({ success: true, data: item });
});

const update = asyncHandler(async (req, res) => {
  const item = await subjectService.updateSubject(req.params.id, req.auth.schoolId, req.body, req.auth.userId);
  res.json({ success: true, data: item });
});

const remove = asyncHandler(async (req, res) => {
  await subjectService.deleteSubject(req.params.id, req.auth.schoolId, req.auth.userId);
  res.status(204).send();
});

module.exports = { list, getOne, create, update, remove };
