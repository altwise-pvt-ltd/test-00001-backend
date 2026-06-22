// Validators for the teaching-assignment module. All three refs are required;
// the service additionally verifies they belong to the school and that the
// teacher actually has the TEACHER role.
const mongoose = require('mongoose');

const isObjectId = (v) => typeof v === 'string' && mongoose.isValidObjectId(v);

function validateCreateTeachingAssignment(body) {
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

  return { valid: Object.keys(errors).length === 0, errors, value };
}

module.exports = { validateCreateTeachingAssignment };
