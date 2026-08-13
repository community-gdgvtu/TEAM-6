// Verification middleware — gates downstream routes on profile status.
//
// These compose with `auth` and `requireRoles`. Order is:
//   auth -> requireRoles(role) -> requireVerifiedPartner|requireVerifiedNgo
//
// `requireVerifiedPartner` looks up the partner profile for the donor user
// and only passes if status === 'Verified'. The profile document is attached
// to req.partner for the handler.

const Partner = require('../models/Partner');
const Ngo = require('../models/Ngo');

const partnerGate = (failureCode) => async (req, res, next) => {
  if (!req.user) {
    return res
      .status(401)
      .json({ error: { message: 'Authentication required', code: 'unauthenticated' } });
  }
  const profile = await Partner.findOne({ userId: req.user._id });
  if (!profile) {
    return res.status(403).json({
      error: { message: 'Partner profile required', code: 'partner_profile_required' },
    });
  }
  if (profile.status !== 'Verified') {
    return res.status(403).json({
      error: {
        message: `Partner profile is ${profile.status}`,
        code: failureCode,
      },
    });
  }
  req.partner = profile;
  next();
};

const ngoGate = (failureCode) => async (req, res, next) => {
  if (!req.user) {
    return res
      .status(401)
      .json({ error: { message: 'Authentication required', code: 'unauthenticated' } });
  }
  const profile = await Ngo.findOne({ userId: req.user._id });
  if (!profile) {
    return res.status(403).json({
      error: { message: 'NGO profile required', code: 'ngo_profile_required' },
    });
  }
  if (profile.status !== 'Verified') {
    return res.status(403).json({
      error: {
        message: `NGO profile is ${profile.status}`,
        code: failureCode,
      },
    });
  }
  req.ngo = profile;
  next();
};

const requireVerifiedPartner = partnerGate('partner_not_verified');
const requireVerifiedNgo = ngoGate('ngo_not_verified');

module.exports = { requireVerifiedPartner, requireVerifiedNgo };