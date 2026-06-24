// Validators for the auth module, used with the validate() middleware.
const mongoose = require('mongoose');

const isObjectId = (v) => typeof v === 'string' && mongoose.isValidObjectId(v);
const isEmail = (v) => typeof v === 'string' && /^\S+@\S+\.\S+$/.test(v);

// LOGIN: schoolId is optional here (multi-tenant disambiguation). Email + pw required.
function validateLogin(body) {
  const errors = {};
  const value = {};

  if (!isEmail(body.email)) {
    errors.email = 'A valid email is required';
  } else {
    value.email = body.email.trim().toLowerCase();
  }

  if (typeof body.password !== 'string' || body.password.length === 0) {
    errors.password = 'Password is required';
  } else {
    value.password = body.password;
  }

  if (body.schoolId !== undefined && body.schoolId !== null) {
    if (!isObjectId(body.schoolId)) {
      errors.schoolId = 'schoolId must be a valid id';
    } else {
      value.schoolId = body.schoolId;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors, value };
}

module.exports = { validateLogin };