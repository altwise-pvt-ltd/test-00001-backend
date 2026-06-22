// Validators for the subject module. name is required; code is an optional
// short identifier (normalized to uppercase, e.g. "MATH").
function validateCreateSubject(body) {
  const errors = {};
  const value = {};

  if (typeof body.name !== 'string' || body.name.trim().length < 2) {
    errors.name = 'Subject name must be at least 2 characters';
  } else {
    value.name = body.name.trim();
  }

  if (body.code !== undefined && body.code !== null && body.code !== '') {
    if (typeof body.code !== 'string') {
      errors.code = 'code must be a string';
    } else {
      value.code = body.code.trim().toUpperCase();
    }
  }

  return { valid: Object.keys(errors).length === 0, errors, value };
}

function validateUpdateSubject(body) {
  const errors = {};
  const value = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2) {
      errors.name = 'Subject name must be at least 2 characters';
    } else {
      value.name = body.name.trim();
    }
  }

  if (body.code !== undefined) {
    if (body.code === null || body.code === '') {
      value.code = '';
    } else if (typeof body.code !== 'string') {
      errors.code = 'code must be a string';
    } else {
      value.code = body.code.trim().toUpperCase();
    }
  }

  if (Object.keys(errors).length === 0 && Object.keys(value).length === 0) {
    errors.body = 'No valid fields to update';
  }

  return { valid: Object.keys(errors).length === 0, errors, value };
}

module.exports = { validateCreateSubject, validateUpdateSubject };
