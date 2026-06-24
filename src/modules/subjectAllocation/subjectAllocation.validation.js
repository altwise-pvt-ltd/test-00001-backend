// Validators for the subject-allocation module. All three refs are required;
// the service additionally verifies they belong to the school and that the
// teacher actually has the TEACHER role.
const mongoose = require('mongoose');

const isObjectId = (v) => typeof v === 'string' && mongoose.isValidObjectId(v);

function validateCreateSubjectAllocation(body) {
  const errors = {};
  const value = {};

  if (!isObjectId(body.teacherId)) {
    errors.teacherId = 'A valid teacherId is required';
  } else {
    value.teacherId = body.teacherId;
  }

  if (!isObjectId(body.subjectId)) {
    errors.subjectId = 'A valid subjectId is required';
  } else {
    value.subjectId = body.subjectId;
  }

  if (!isObjectId(body.sectionId)) {
    errors.sectionId = 'A valid sectionId is required';
  } else {
    value.sectionId = body.sectionId;
  }

  // classId is OPTIONAL: the service derives it from the section. If the client
  // does send one we validate it's a well-formed id (the service then checks it
  // actually matches the section's class).
  if (body.classId !== undefined) {
    if (!isObjectId(body.classId)) {
      errors.classId = 'classId, if provided, must be a valid id';
    } else {
      value.classId = body.classId;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors, value };
}

module.exports = { validateCreateSubjectAllocation };
