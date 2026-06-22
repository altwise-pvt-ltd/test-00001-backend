// HTTP layer for submissions. Access is role-scoped inside the service via
// req.auth; create is students-only and grade is teachers-only at the route.
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./submission.service');

const list = asyncHandler(async (req, res) => {
  const items = await service.listSubmissions(req.auth, { assignmentId: req.query.assignmentId });
  res.json({ success: true, data: items });
});

const getOne = asyncHandler(async (req, res) => {
  const item = await service.getSubmissionById(req.params.id, req.auth);
  res.json({ success: true, data: item });
});

const create = asyncHandler(async (req, res) => {
  const item = await service.createSubmission(req.auth, req.body);
  res.status(201).json({ success: true, data: item });
});

const grade = asyncHandler(async (req, res) => {
  const item = await service.gradeSubmission(req.params.id, req.auth, req.body);
  res.json({ success: true, data: item });
});

module.exports = { list, getOne, create, grade };
