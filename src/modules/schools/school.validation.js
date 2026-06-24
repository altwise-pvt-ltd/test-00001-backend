// Validators for the schools module (super-admin provisions + oversees schools).
const mongoose = require('mongoose');

const isObjectId = (v) => typeof v === 'string' && mongoose.isValidObjectId(v);

// CREATE: { name, address? }. isActive is forced true in the service.
function validateCreateSchool(body) {
  const errors = {};
  const value = {};

  if (typeof body.name !== 'string' || body.name.trim().length < 2) {
    errors.name = 'School name must be at least 2 characters';
  } else {
    value.name = body.name.trim();
  }

  if (body.address !== undefined) {
    if (typeof body.address !== 'string') {
      errors.address = 'Address must be a string';
    } else {
      value.address = body.address.trim();
    }
  }

  return { valid: Object.keys(errors).length === 0, errors, value };
}

// ASSIGN: { principalId }.
function validateAssignPrincipal(body) {
  const errors = {};
  const value = {};

  if (!isObjectId(body.principalId)) {
    errors.principalId = 'principalId must be a valid id';
  } else {
    value.principalId = body.principalId;
  }

  return { valid: Object.keys(errors).length === 0, errors, value };
}

module.exports = { validateCreateSchool, validateAssignPrincipal };
