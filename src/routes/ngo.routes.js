// /api/ngos — NGO verification profiles. Mirror of partner.routes.js.
//
//   POST  /register     ngo submits a profile (Pending)
//   GET   /me           ngo reads own profile
//   PATCH /me           ngo edits own profile (Pending or Rejected only)
//   GET   /pending      admin lists Pending profiles
//   PATCH /:id/verify   admin approves/rejects a profile

const express = require('express');
const { z } = require('zod');

const asyncHandler = require('../utils/asyncHandler');
const { auth } = require('../middleware/auth');
const { requireRoles } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const {
  registerNgo,
  getMyNgo,
  updateMyNgo,
  listPendingNgos,
  verifyNgo,
} = require('../controllers/ngo.controller');

const router = express.Router();

const NgoRegisterSchema = z.object({
  ngoName: z.string().min(2).max(120),
  registrationNumber: z.string().min(1).max(80),
  address: z.string().min(1).max(300),
  contactNumber: z.string().min(7).max(20),
  focalPersonName: z.string().min(2).max(80),
  focalPersonContact: z.string().min(7).max(20),
});

const NgoUpdateSchema = z
  .object({
    ngoName: z.string().min(2).max(120).optional(),
    registrationNumber: z.string().min(1).max(80).optional(),
    address: z.string().min(1).max(300).optional(),
    contactNumber: z.string().min(7).max(20).optional(),
    focalPersonName: z.string().min(2).max(80).optional(),
    focalPersonContact: z.string().min(7).max(20).optional(),
  })
  .strict();

const NgoVerifySchema = z
  .object({
    status: z.enum(['Verified', 'Rejected']),
    rejectionReason: z.string().max(500).optional(),
  })
  .strict();

router.post(
  '/register',
  auth,
  requireRoles('ngo'),
  validate(NgoRegisterSchema),
  asyncHandler(registerNgo),
);

router.get('/me', auth, requireRoles('ngo'), asyncHandler(getMyNgo));

router.patch(
  '/me',
  auth,
  requireRoles('ngo'),
  validate(NgoUpdateSchema),
  asyncHandler(updateMyNgo),
);

router.get(
  '/pending',
  auth,
  requireRoles('admin'),
  asyncHandler(listPendingNgos),
);

router.patch(
  '/:id/verify',
  auth,
  requireRoles('admin'),
  validate(NgoVerifySchema),
  asyncHandler(verifyNgo),
);

module.exports = router;