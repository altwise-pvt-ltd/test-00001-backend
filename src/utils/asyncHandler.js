// Wraps async route handlers so rejected promises are forwarded to Express's
// error middleware instead of crashing the process. Lets controllers use
// async/await without repetitive try/catch.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
