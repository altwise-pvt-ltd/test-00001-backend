// Lightweight validation middleware factory.
// Pass a function (body) => ({ valid, errors, value }); on failure it throws a
// 400. Swap this for zod/joi later without touching controllers.
const ApiError = require('../utils/ApiError');

function validate(validator) {
  return (req, res, next) => {
    const { valid, errors, value } = validator(req.body || {});
    if (!valid) {
      return next(ApiError.badRequest('Validation failed', errors));
    }
    req.body = value ?? req.body;
    next();
  };
}

module.exports = validate;
