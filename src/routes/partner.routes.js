// /api/partners — donor business verification profiles.
//
//   POST  /register     donor submits a profile (Pending)
//   GET   /me           donor reads own profile
//   PATCH /me           donor edits own profile (Pending or Rejected only)
//   GET   /pending      admin lists Pending profiles
//   PATCH /:id/verify   admin approves/rejects a profile

const express = require('express');
const { z } = require('zod');

const asyncHandler = require('../utils/asyncHandler');
const { auth } = require('../middleware/auth');
const { requireRoles } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const {
  registerPartner,
  getMyPartner,
  updateMyPartner,
  listPendingPartners,
  verifyPartner,
} = require('../controllers/partner.controller');

const router = express.Router();

const PartnerRegisterSchema = z.object({
  businessName: z.string().min(2).max(120),
  businessType: z.enum(['restaurant', 'hotel', 'event', 'catering', 'other']),
  businessLicense: z.string().min(1).max(80),
  address: z.string().min(1).max(300),
  contactNumber: z.string().min(7).max(20),
});

const PartnerUpdateSchema = z
  .object({
    businessName: z.string().min(2).max(120).optional(),
    businessType: z.enum(['restaurant', 'hotel', 'event', 'catering', 'other']).optional(),
    businessLicense: z.string().min(1).max(80).optional(),
    address: z.string().min(1).max(300).optional(),
    contactNumber: z.string().min(7).max(20).optional(),
  })
  .strict();

const PartnerVerifySchema = z
  .object({
    status: z.enum(['Verified', 'Rejected']),
    rejectionReason: z.string().max(500).optional(),
  })
  .strict();

router.post(
  '/register',
  auth,
  requireRoles('donor'),
  validate(PartnerRegisterSchema),
  asyncHandler(registerPartner),
);

router.get('/me', auth, requireRoles('donor'), asyncHandler(getMyPartner));

router.patch(
  '/me',
  auth,
  requireRoles('donor'),
  validate(PartnerUpdateSchema),
  asyncHandler(updateMyPartner),
);

router.get(
  '/pending',
  auth,
  requireRoles('admin'),
  asyncHandler(listPendingPartners),
);

router.patch(
  '/:id/verify',
  auth,
  requireRoles('admin'),
  validate(PartnerVerifySchema),
  asyncHandler(verifyPartner),
);

module.exports = router;