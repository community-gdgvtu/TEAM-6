// Ngo controller — mirror of partner.controller.js with NGO-specific fields.
//
// Routes:
//   POST  /api/ngos/register  -> registerNgo
//   GET   /api/ngos/me        -> getMyNgo
//   PATCH /api/ngos/me        -> updateMyNgo
//   GET   /api/ngos/pending   -> listPendingNgos
//   PATCH /api/ngos/:id/verify -> verifyNgo

const Ngo = require('../models/Ngo');

const DUPLICATE_KEY_CODE = 11000;

const registerNgo = async (req, res) => {
  const userId = req.user._id;
  const body = req.body || {};

  let profile;
  try {
    profile = await Ngo.create({ ...body, userId });
  } catch (err) {
    if (err && err.code === DUPLICATE_KEY_CODE) {
      return res
        .status(409)
        .json({ error: { message: 'NGO profile already exists', code: 'profile_already_exists' } });
    }
    if (err && err.name === 'ValidationError') {
      const message = Object.values(err.errors)[0]?.message || 'Invalid input';
      return res.status(400).json({ error: { message, code: 'validation_error' } });
    }
    throw err;
  }

  return res.status(201).json({ data: profile });
};

const getMyNgo = async (req, res) => {
  const profile = await Ngo.findOne({ userId: req.user._id });
  if (!profile) {
    return res
      .status(404)
      .json({ error: { message: 'NGO profile not found', code: 'not_found' } });
  }
  return res.json({ data: profile });
};

const updateMyNgo = async (req, res) => {
  const profile = await Ngo.findOne({ userId: req.user._id });
  if (!profile) {
    return res
      .status(404)
      .json({ error: { message: 'NGO profile not found', code: 'not_found' } });
  }

  if (profile.status === 'Verified') {
    return res
      .status(403)
      .json({ error: { message: 'NGO profile is verified and frozen', code: 'profile_frozen' } });
  }

  const {
    ngoName,
    registrationNumber,
    address,
    contactNumber,
    focalPersonName,
    focalPersonContact,
  } = req.body || {};
  if (ngoName !== undefined) profile.ngoName = ngoName;
  if (registrationNumber !== undefined) profile.registrationNumber = registrationNumber;
  if (address !== undefined) profile.address = address;
  if (contactNumber !== undefined) profile.contactNumber = contactNumber;
  if (focalPersonName !== undefined) profile.focalPersonName = focalPersonName;
  if (focalPersonContact !== undefined) profile.focalPersonContact = focalPersonContact;

  if (profile.status === 'Rejected') {
    profile.status = 'Pending';
    profile.reviewedBy = null;
    profile.reviewedAt = null;
    profile.rejectionReason = null;
  }

  await profile.save();
  return res.json({ data: profile });
};

const listPendingNgos = async (_req, res) => {
  const profiles = await Ngo.find({ status: 'Pending' }).sort({ createdAt: -1 });
  return res.json({ data: profiles });
};

const verifyNgo = async (req, res) => {
  const { id } = req.params;
  const { status, rejectionReason } = req.body || {};

  if (status === 'Rejected' && (!rejectionReason || rejectionReason.trim() === '')) {
    return res.status(400).json({
      error: { message: 'rejectionReason is required when rejecting', code: 'rejection_reason_required' },
    });
  }

  const profile = await Ngo.findById(id);
  if (!profile) {
    return res
      .status(404)
      .json({ error: { message: 'NGO profile not found', code: 'not_found' } });
  }

  if (profile.userId.equals(req.user._id)) {
    return res
      .status(403)
      .json({ error: { message: 'Cannot review your own profile', code: 'self_review_forbidden' } });
  }

  profile.status = status;
  profile.reviewedBy = req.user._id;
  profile.reviewedAt = new Date();
  profile.rejectionReason = status === 'Rejected' ? rejectionReason : null;

  await profile.save();
  return res.json({ data: profile });
};

module.exports = {
  registerNgo,
  getMyNgo,
  updateMyNgo,
  listPendingNgos,
  verifyNgo,
};