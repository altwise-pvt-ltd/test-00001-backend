// Validators for the section module. A section has a short name ("A", "B")
// and belongs to a class (classId). Names are normalized to uppercase so "a"
// and "A" can't both exist in the same class.
const mongoose = require('mongoose');

const isObjectId = (v) => typeof v === 'string' && mongoose.isValidObjectId(v);

function validateCreateSection(body) {
  const errors = {};
  const value = {};

  if (typeof body.name !== 'string' || body.name.trim().length < 1) {
    errors.name = 'Section name is required';
  } else {
    value.name = body.name.trim().toUpperCase();
  }

  if (!isObjectId(body.classId)) {
    errors.classId = 'A valid classId is required';
  } else {
    value.classId = body.classId;
  }

  return { valid: Object.keys(errors).length === 0, errors, value };
}

function validateUpdateSection(body) {
  const errors = {};
  const value = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 1) {
      errors.name = 'Section name must be a non-empty string';
    } else {
      value.name = body.name.trim().toUpperCase();
    }
  }

  if (body.classId !== undefined) {
    if (!isObjectId(body.classId)) {
      errors.classId = 'classId must be a valid id';
    } else {
      value.classId = body.classId;
    }
  }

  if (Object.keys(errors).length === 0 && Object.keys(value).length === 0) {
    errors.body = 'No valid fields to update';
  }

  return { valid: Object.keys(errors).length === 0, errors, value };
}

module.exports = { validateCreateSection, validateUpdateSection };
