// Business logic for sections. Tenant-scoped by schoolId. A section must belong
// to a class that exists in the same school, so we verify classId before
// create/update. Soft-delete only.
//
// Managed by BOTH a principal (own school) and the super-admin (a school they
// target explicitly). schoolId is resolved upstream (resolveSchoolScope); every
// mutation re-verifies that target school exists and is not soft-deleted.
const Section = require('./section.model');
const Class = require('../class/class.model');
const ApiError = require('../../utils/ApiError');
const { assertSchoolExists } = require('../schools/school.guard');

// Guard: the referenced class must exist and belong to this school.
async function assertClassInSchool(classId, schoolId) {
  const klass = await Class.findOne({ _id: classId, schoolId, deletedAt: null });
  if (!klass) {
    throw ApiError.badRequest('classId does not reference a class in this school');
  }
  return klass;
}

async function listSections(schoolId, filter = {}) {
  const query = { schoolId, deletedAt: null };
  if (filter.classId) query.classId = filter.classId;
  return Section.find(query).sort({ createdAt: 1 });
}

async function getSectionById(id, schoolId) {
  const doc = await Section.findOne({ _id: id, schoolId, deletedAt: null });
  if (!doc) throw ApiError.notFound('Section not found');
  return doc;
}

async function createSection(schoolId, data, userId) {
  await assertSchoolExists(schoolId);
  await assertClassInSchool(data.classId, schoolId);
  const existing = await Section.findOne({
    classId: data.classId,
    name: data.name,
    deletedAt: null,
  });
  if (existing) throw ApiError.conflict(`Section ${data.name} already exists for this class`);
  return Section.create({ ...data, schoolId, createdBy: userId });
}

async function updateSection(id, schoolId, data, userId) {
  await assertSchoolExists(schoolId);
  if (data.classId) await assertClassInSchool(data.classId, schoolId);
  const doc = await Section.findOneAndUpdate(
    { _id: id, schoolId, deletedAt: null },
    { ...data, updatedBy: userId },
    { new: true, runValidators: true }
  );
  if (!doc) throw ApiError.notFound('Section not found');
  return doc;
}

async function deleteSection(id, schoolId, userId) {
  await assertSchoolExists(schoolId);
  const doc = await Section.findOneAndUpdate(
    { _id: id, schoolId, deletedAt: null },
    { deletedAt: new Date(), updatedBy: userId },
    { new: true }
  );
  if (!doc) throw ApiError.notFound('Section not found');
  return doc;
}

module.exports = {
  listSections,
  getSectionById,
  createSection,
  updateSection,
  deleteSection,
};
