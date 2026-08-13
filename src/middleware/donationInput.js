// Donation-specific input normalization.
//
// FormData has no native object field, so clients may send location as a JSON
// string: form.append('location', JSON.stringify({ type: 'Point', coordinates: [lng, lat] })).
// Multer's bracket notation output is already an object and passes through.

const { removeUploadedFile } = require('./upload');

const normalizeDonationLocation = (req, res, next) => {
  const location = req.body && req.body.location;
  if (typeof location !== 'string') return next();

  try {
    req.body.location = JSON.parse(location);
    return next();
  } catch {
    removeUploadedFile(req.file);
    return res.status(400).json({
      error: {
        message: 'location must be a JSON object with coordinates [lng, lat]',
        code: 'validation_error',
      },
    });
  }
};

module.exports = { normalizeDonationLocation };
