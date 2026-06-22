// HTTP layer for teaching assignments. GET / supports optional ?teacherId,
// ?sectionId, ?subjectId filters (e.g. a teacher listing their own).
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./teachingAssignment.service');

const list = asyncHandler(async (req, res) => {
  const items = await service.listTeachingAssignments(req.auth.schoolId, {
    teacherId: req.query.teacherId,
    sectionId: req.query.sectionId,
    subjectId: req.query.subjectId,
  });
  res.json({ success: true, data: items });
});

const create = asyncHandler(async (req, res) => {
  const item = await service.createTeachingAssignment(req.auth.schoolId, req.body, req.auth.userId);
  res.status(201).json({ success: true, data: item });
});

const remove = asyncHandler(async (req, res) => {
  await service.deleteTeachingAssignment(req.params.id, req.auth.schoolId, req.auth.userId);
  res.status(204).send();
});

module.exports = { list, create, remove };
