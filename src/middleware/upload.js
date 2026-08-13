// multer-based image upload middleware.
//
// Files are streamed to disk under <repo>/uploads/ with a random filename.
// Validates the declared MIME type and size before writing, then verifies the
// file signature after writing. (Multer cannot inspect a streaming file's
// bytes in its fileFilter.)
//
// Public surface:
//   upload.single('image')  — Multer middleware for the single-file upload route
//   ALLOWED_MIME            — Set<string> of accepted MIME types

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] || 'bin';
    const random = crypto.randomBytes(12).toString('hex');
    cb(null, `${random}.${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new MulterError('UNSUPPORTED_MEDIA_TYPE', file.mimetype));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_BYTES, files: 1 },
});

// Custom error class so we can map multer errors to our standard envelope
// without leaking multer-internal messages.
class MulterError extends Error {
  constructor(code, info) {
    super(code);
    this.name = 'MulterValidationError';
    this.code = code;
    this.info = info;
    this.status = 400;
  }
}

// Delete a request-owned upload without allowing cleanup failures to mask the
// original client error. This is used whenever later validation rejects a
// request after Multer has already written the file.
const removeUploadedFile = (file) => {
  if (!file || !file.path) return;
  try {
    fs.unlinkSync(file.path);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      // eslint-disable-next-line no-console
      console.warn('[upload] Could not remove rejected upload:', err.message);
    }
  }
};

// Minimal, deterministic magic-byte checks. The declared MIME type must agree
// with the content, which blocks empty files and simple MIME spoofing without
// adding a native image-processing dependency.
const detectImageMime = (buffer) => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) return 'image/png';
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return 'image/webp';
  return null;
};

const verifyUploadedImage = (req, res, next) => {
  if (!req.file) return next();

  let detectedMime;
  try {
    detectedMime = detectImageMime(fs.readFileSync(req.file.path));
  } catch (err) {
    removeUploadedFile(req.file);
    return next(err);
  }

  if (!detectedMime || detectedMime !== req.file.mimetype) {
    removeUploadedFile(req.file);
    return res.status(400).json({
      error: {
        message: 'Image content must match its declared JPEG, PNG, or WebP type',
        code: 'invalid_image_content',
      },
    });
  }
  return next();
};

// Map multer's built-in errors and our custom ones to the standard envelope.
// Mount this after `upload.single(...)` so it can catch anything multer threw.
const handleUploadErrors = (err, _req, res, next) => {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: { message: `Image must be at most ${MAX_BYTES / 1024 / 1024} MB`, code: 'image_too_large' },
      });
    }
    return res.status(400).json({ error: { message: err.message, code: 'upload_error' } });
  }
  if (err && err.code === 'UNSUPPORTED_MEDIA_TYPE') {
    return res.status(400).json({
      error: {
        message: `Unsupported image type. Allowed: ${[...ALLOWED_MIME].join(', ')}`,
        code: 'unsupported_image_type',
      },
    });
  }
  return next(err);
};

module.exports = {
  upload,
  handleUploadErrors,
  verifyUploadedImage,
  removeUploadedFile,
  detectImageMime,
  ALLOWED_MIME,
  MAX_BYTES,
  UPLOAD_DIR,
};
