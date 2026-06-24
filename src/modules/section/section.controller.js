// HTTP layer for sections. GET / supports an optional ?classId filter.
// req.schoolId is set by resolveSchoolScope — the principal's own school, or the
// school the admin targeted via /api/schools/:schoolId/sections.
const asyncHandler = require('../../utils/asyncHandler');
const sectionService = require('./section.service');

const list = asyncHandler(async (req, res) => {
  const items = await sectionService.listSections(req.schoolId, {
    classId: req.query.classId,
  });
  res.json({ success: true, data: items });
});

const getOne = asyncHandler(async (req, res) => {
  const item = await sectionService.getSectionById(req.params.id, req.schoolId);
  res.json({ success: true, data: item });
});

const create = asyncHandler(async (req, res) => {
  const item = await sectionService.createSection(req.schoolId, req.body, req.auth.userId);
  res.status(201).json({ success: true, data: item });
});

const update = asyncHandler(async (req, res) => {
  const item = await sectionService.updateSection(req.params.id, req.schoolId, req.body, req.auth.userId);
  res.json({ success: true, data: item });
});

const remove = asyncHandler(async (req, res) => {
  await sectionService.deleteSection(req.params.id, req.schoolId, req.auth.userId);
  res.status(204).send();
});

module.exports = { list, getOne, create, update, remove };
