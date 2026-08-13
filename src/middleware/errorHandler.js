// Centralized error handler. Returns a consistent JSON envelope:
//   { error: { message, code? } }
//
// express-async-errors (loaded in app.js) makes `next(err)` unnecessary in
// async route handlers — thrown errors land here automatically.

const errorHandler = (err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error('[error]', err);

  const status = err.status || err.statusCode || 500;
  const code = err.code || (status === 500 ? 'internal_error' : 'error');

  res.status(status).json({
    error: {
      message: err.expose === false || status === 500 ? 'Internal server error' : err.message,
      code,
    },
  });
};

module.exports = errorHandler;
