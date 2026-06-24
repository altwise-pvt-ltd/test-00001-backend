// Shared guard: verify a school exists and is not soft-deleted.
//
// Used wherever an ADMIN targets a school explicitly (they have no schoolId of
// their own) for subjects/classes/sections. For principals the schoolId comes
// from their verified token and is implicitly valid, but running the same guard
// is cheap and keeps the service authoritative regardless of caller.
const mongoose = require('mongoose');
const School = require('../../models/School');
const ApiError = require('../../utils/ApiError');

async function assertSchoolExists(schoolId) {
  if (!mongoose.isValidObjectId(schoolId)) throw ApiError.notFound('School not found');
  const school = await School.findOne({ _id: schoolId, deletedAt: null });
  if (!school) throw ApiError.notFound('School not found');
  return school;
}

module.exports = { assertSchoolExists };
