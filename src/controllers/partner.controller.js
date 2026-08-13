// Partner controller.
//
// Routes:
//   POST  /api/partners/register  -> registerPartner
//   GET   /api/partners/me        -> getMyPartner
//   PATCH /api/partners/me        -> updateMyPartner
//   GET   /api/partners/pending   -> listPendingPartners
//   PATCH /api/partners/:id/verify -> verifyPartner

const Partner = require('../models/Partner');

const DUPLICATE_KEY_CODE = 11000;

// Register a new partner profile for the caller (donor).
// 409 if a profile already exists for this user.
const registerPartner = async (req, res) => {
  const userId = req.user._id;
  const body = req.body || {};

  let profile;
  try {
    profile = await Partner.create({ ...body, userId });
  } catch (err) {
    if (err && err.code === DUPLICATE_KEY_CODE) {
      return res
        .status(409)
        .json({ error: { message: 'Partner profile already exists', code: 'profile_already_exists' } });
    }
    if (err && err.name === 'ValidationError') {
      const message = Object.values(err.errors)[0]?.message || 'Invalid input';
      return res.status(400).json({ error: { message, code: 'validation_error' } });
    }
    throw err;
  }

  return res.status(201).json({ data: profile });
};

// Get the caller's own partner profile. 404 if none yet.
const getMyPartner = async (req, res) => {
  const profile = await Partner.findOne({ userId: req.user._id });
  if (!profile) {
    return res
      .status(404)
      .json({ error: { message: 'Partner profile not found', code: 'not_found' } });
  }
  return res.json({ data: profile });
};

// Edit-while-pending + re-submit-after-rejection.
//
// Rules:
//   - Pending: full edit allowed
//   - Rejected: status flips back to Pending; audit fields cleared
//   - Verified: 403 profile_frozen (admin must reset)
const updateMyPartner = async (req, res) => {
  const profile = await Partner.findOne({ userId: req.user._id });
  if (!profile) {
    return res
      .status(404)
      .json({ error: { message: 'Partner profile not found', code: 'not_found' } });
  }

  if (profile.status === 'Verified') {
    return res
      .status(403)
      .json({ error: { message: 'Partner profile is verified and frozen', code: 'profile_frozen' } });
  }

  const { businessName, businessType, businessLicense, address, contactNumber } = req.body || {};
  if (businessName !== undefined) profile.businessName = businessName;
  if (businessType !== undefined) profile.businessType = businessType;
  if (businessLicense !== undefined) profile.businessLicense = businessLicense;
  if (address !== undefined) profile.address = address;
  if (contactNumber !== undefined) profile.contactNumber = contactNumber;

  // Re-submission flow: any update from Rejected returns the profile to Pending
  // and clears the audit fields.
  if (profile.status === 'Rejected') {
    profile.status = 'Pending';
    profile.reviewedBy = null;
    profile.reviewedAt = null;
    profile.rejectionReason = null;
  }

  await profile.save();
  return res.json({ data: profile });
};

// Admin: list pending profiles.
const listPendingPartners = async (_req, res) => {
  const profiles = await Partner.find({ status: 'Pending' }).sort({ createdAt: -1 });
  return res.json({ data: profiles });
};

// Admin: verify or reject a partner profile by id.
const verifyPartner = async (req, res) => {
  const { id } = req.params;
  const { status, rejectionReason } = req.body || {};

  if (status === 'Rejected' && (!rejectionReason || rejectionReason.trim() === '')) {
    return res.status(400).json({
      error: { message: 'rejectionReason is required when rejecting', code: 'rejection_reason_required' },
    });
  }

  const profile = await Partner.findById(id);
  if (!profile) {
    return res
      .status(404)
      .json({ error: { message: 'Partner profile not found', code: 'not_found' } });
  }

  // Admin must not review their own profile (defensive — an admin is not a
  // donor by role, but a future dual-account model could make this relevant).
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
  registerPartner,
  getMyPartner,
  updateMyPartner,
  listPendingPartners,
  verifyPartner,
};