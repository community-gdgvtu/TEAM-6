// Async route helper. Wraps an async handler so thrown errors propagate to
// the centralized error handler (works because express-async-errors is loaded
// in app.js — we still use this for explicit consistency).

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;