// Validators for the class module. A class is identified by its canonical grade
// level (1..12) from the shared CLASS_LEVELS constant — never a free-text name.
const { CLASS_LEVELS } = require('../../constant/constant');

function validateCreateClass(body) {
  const errors = {};
  const value = {};

  const level = Number(body.level);
  if (!Number.isInteger(level) || !CLASS_LEVELS.includes(level)) {
    errors.level = `level must be one of: ${CLASS_LEVELS.join(', ')}`;
  } else {
    value.level = level;
  }

  return { valid: Object.keys(errors).length === 0, errors, value };
}

function validateUpdateClass(body) {
  const errors = {};
  const value = {};

  if (body.level !== undefined) {
    const level = Number(body.level);
    if (!Number.isInteger(level) || !CLASS_LEVELS.includes(level)) {
      errors.level = `level must be one of: ${CLASS_LEVELS.join(', ')}`;
    } else {
      value.level = level;
    }
  }

  if (Object.keys(errors).length === 0 && Object.keys(value).length === 0) {
    errors.body = 'No valid fields to update';
  }

  return { valid: Object.keys(errors).length === 0, errors, value };
}

module.exports = { validateCreateClass, validateUpdateClass };
