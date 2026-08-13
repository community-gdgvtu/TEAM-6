// Upload controller — handles POST /api/uploads.
//
// The actual file parsing/validation is done by the multer middleware
// (see ../middleware/upload). This controller only formats the response
// once a file has been accepted.

const uploadImage = (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ error: { message: 'image file is required (multipart field "image")', code: 'image_required' } });
  }
  // URL is relative to the server root so the frontend can prepend its base.
  const url = `/uploads/${req.file.filename}`;
  return res.status(201).json({
    data: {
      url,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    },
  });
};

module.exports = { uploadImage };