// Generic Zod-based request body validator.
//
// Usage:
//   router.post('/foo', auth, validate(FooSchema), handler)
//
// Returns 400 with the first Zod issue on failure. On success, replaces
// req.body with the parsed (and possibly coerced) result.

const { removeUploadedFile } = require('./upload');

const validate = (schema) => (req, res, next) => {
  if (!schema) return next();
  const result = schema.safeParse(req.body);
  if (!result.success) {
    // A multipart file has already been persisted by Multer at this point.
    // Do not leave it behind if the companion request body is invalid.
    removeUploadedFile(req.file);
    const issue = result.error.issues[0];
    return res.status(400).json({
      error: {
        message: issue?.message || 'Invalid request body',
        code: 'validation_error',
      },
    });
  }
  req.body = result.data;
  next();
};

module.exports = { validate };
