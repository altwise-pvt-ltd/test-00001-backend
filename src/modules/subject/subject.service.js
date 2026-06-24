// Business logic for subjects. Tenant-scoped by schoolId. Subject name is
// unique within a school. Soft-delete only.
//
// Managed by BOTH a principal (own school) and the super-admin (a school they
// target explicitly). schoolId is resolved upstream (resolveSchoolScope) — from
// the principal's token or the admin's :schoolId route param — and every
// mutation re-verifies that target school exists and is not soft-deleted.
const Subject = require('./subject.model');
const ApiError = require('../../utils/ApiError');
const { assertSchoolExists } = require('../schools/school.guard');

async function listSubjects(schoolId) {
  return Subject.find({ schoolId, deletedAt: null }).sort({ name: 1 });
}

async function getSubjectById(id, schoolId) {
  const doc = await Subject.findOne({ _id: id, schoolId, deletedAt: null });
  if (!doc) throw ApiError.notFound('Subject not found');
  return doc;
}

async function createSubject(schoolId, data, userId) {
  await assertSchoolExists(schoolId);
  const existing = await Subject.findOne({ schoolId, name: data.name, deletedAt: null });
  if (existing) throw ApiError.conflict(`Subject "${data.name}" already exists`);
  return Subject.create({ ...data, schoolId, createdBy: userId });
}

async function updateSubject(id, schoolId, data, userId) {
  await assertSchoolExists(schoolId);
  const doc = await Subject.findOneAndUpdate(
    { _id: id, schoolId, deletedAt: null },
    { ...data, updatedBy: userId },
    { new: true, runValidators: true }
  );
  if (!doc) throw ApiError.notFound('Subject not found');
  return doc;
}

async function deleteSubject(id, schoolId, userId) {
  await assertSchoolExists(schoolId);
  const doc = await Subject.findOneAndUpdate(
    { _id: id, schoolId, deletedAt: null },
    { deletedAt: new Date(), updatedBy: userId },
    { new: true }
  );
  if (!doc) throw ApiError.notFound('Subject not found');
  return doc;
}

module.exports = {
  listSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
};
