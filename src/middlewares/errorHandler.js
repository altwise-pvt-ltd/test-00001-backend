// Central error handler. Must be registered LAST (4-arg signature).
// Converts thrown errors into a consistent JSON shape.
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details;

  // Normalize common Mongoose errors into friendly responses.
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => e.message);
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err.code === 11000) {
    statusCode = 409;
    message = `Duplicate value for: ${Object.keys(err.keyValue).join(', ')}`;
  }

  if (statusCode >= 500) {
    console.error('[error]', err);
  }

  // Frontend reads error.message — nest everything under `error`.
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(details ? { details } : {}),
      ...(config.env === 'development' && statusCode >= 500
        ? { stack: err.stack }
        : {}),
    },
  });
}

module.exports = errorHandler;
