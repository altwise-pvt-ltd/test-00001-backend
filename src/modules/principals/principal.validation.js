// Validators for the principals module (super-admin creates principals).
const isEmail = (v) => typeof v === 'string' && /^\S+@\S+\.\S+$/.test(v);

// CREATE: { name, email, password }. role/schoolId are NOT accepted from the
// body — the service forces role 'principal' and schoolId null (unassigned).
function validateCreatePrincipal(body) {
  const errors = {};
  const value = {};

  if (typeof body.name !== 'string' || body.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  } else {
    value.name = body.name.trim();
  }

  if (!isEmail(body.email)) {
    errors.email = 'A valid email is required';
  } else {
    value.email = body.email.trim().toLowerCase();
  }

  if (typeof body.password !== 'string' || body.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  } else {
    value.password = body.password;
  }

  return { valid: Object.keys(errors).length === 0, errors, value };
}

module.exports = { validateCreatePrincipal };
