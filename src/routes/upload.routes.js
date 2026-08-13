// /api/uploads — image upload (Phase 4).
//
// Any authenticated user (donor, ngo, admin) can upload. The returned URL
// is a relative path under /uploads/, which the frontend can prepend with
// its base URL.

const express = require('express');

const asyncHandler = require('../utils/asyncHandler');
const { auth } = require('../middleware/auth');
const { upload, handleUploadErrors, verifyUploadedImage } = require('../middleware/upload');
const { uploadImage } = require('../controllers/upload.controller');

const router = express.Router();

router.post(
  '/',
  auth,
  upload.single('image'),
  handleUploadErrors,
  verifyUploadedImage,
  asyncHandler(uploadImage),
);

module.exports = router;
