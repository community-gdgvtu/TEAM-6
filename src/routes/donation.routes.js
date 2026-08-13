// /api/donations — Phase 4: create + get-by-id.

const express = require('express');
const { z } = require('zod');

const asyncHandler = require('../utils/asyncHandler');
const { auth, optionalAuth } = require('../middleware/auth');
const { requireRoles } = require('../middleware/role');
const { requireVerifiedPartner, requireVerifiedNgo } = require('../middleware/verification');
const { upload, handleUploadErrors, verifyUploadedImage } = require('../middleware/upload');
const { normalizeDonationLocation } = require('../middleware/donationInput');
const { validate } = require('../middleware/validate');
const {
  createDonation,
  getDonationById,
  listDonations,
  listMyDonations,
  updateDonation,
  changeDonationStatus,
  deleteDonation,
  reserveDonation,
  cancelReservation,
  completeReservation,
  listMyReservations,
} = require('../controllers/donation.controller');
const { CATEGORIES } = require('../constants/categories');

const router = express.Router();

// Coordinates arrive as numbers; we keep them as a 2-tuple of (lng, lat).
// Numeric fields use `coerce.number` so multipart/form-data submissions
// (where every field is a string by default) and JSON submissions both work.
const DonationCreateSchema = z
  .object({
    title: z.string().min(2).max(100),
    description: z.string().max(1000).optional(),
    category: z.enum(CATEGORIES),
    quantity: z.coerce.number().int().min(1),
    unit: z.string().min(1).max(20),
    expiry: z.coerce.date().refine((d) => d.getTime() > Date.now(), {
      message: 'expiry must be in the future',
    }),
    pickupAddress: z.string().min(5).max(300),
    allergens: z.string().max(300).optional(),
    location: z
      .object({
        type: z.literal('Point').optional(),
        coordinates: z.tuple([
          z.coerce.number().min(-180).max(180), // lng
          z.coerce.number().min(-90).max(90),   // lat
        ]),
      })
      .optional()
      .default({ type: 'Point', coordinates: [77.5946, 12.9716] }),
    estimatedValue: z.coerce.number().min(0).optional(),
  })
  .strict(); // reject unknown fields

const DonationUpdateSchema = z
  .object({
    title: z.string().min(2).max(100).optional(),
    description: z.string().max(1000).optional(),
    category: z.enum(CATEGORIES).optional(),
    quantity: z.coerce.number().int().min(1).optional(),
    unit: z.string().min(1).max(20).optional(),
    expiry: z.coerce.date().refine((d) => d.getTime() > Date.now(), {
      message: 'expiry must be in the future',
    }).optional(),
    pickupAddress: z.string().min(5).max(300).optional(),
    allergens: z.string().max(300).optional(),
    location: z.object({
      type: z.literal('Point').optional(),
      coordinates: z.tuple([
        z.coerce.number().min(-180).max(180),
        z.coerce.number().min(-90).max(90),
      ]),
    }).optional(),
    estimatedValue: z.coerce.number().min(0).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

const DonationStatusSchema = z.object({ status: z.enum(['cancelled', 'completed']) }).strict();

// Discovery only exposes active, unexpired donations. Optional auth leaves
// room for personalized presentation without making browsing private.
router.get('/', optionalAuth, asyncHandler(listDonations));
router.get('/nearby', optionalAuth, asyncHandler(listDonations));
router.get('/mine', auth, requireRoles('donor'), asyncHandler(listMyDonations));
router.get('/my-reservations', auth, requireRoles('ngo'), requireVerifiedNgo, asyncHandler(listMyReservations));

router.post(
  '/',
  auth,
  requireRoles('donor'),
  requireVerifiedPartner,
  upload.single('image'),
  handleUploadErrors,
  verifyUploadedImage,
  normalizeDonationLocation,
  validate(DonationCreateSchema),
  asyncHandler(createDonation),
);

router.patch(
  '/:id', auth, requireRoles('donor'), normalizeDonationLocation,
  validate(DonationUpdateSchema), asyncHandler(updateDonation),
);
router.patch(
  '/:id/status', auth, requireRoles('donor'), validate(DonationStatusSchema),
  asyncHandler(changeDonationStatus),
);
router.delete('/:id', auth, requireRoles('admin'), asyncHandler(deleteDonation));
router.post('/:id/reserve', auth, requireRoles('ngo'), requireVerifiedNgo, asyncHandler(reserveDonation));
router.post('/:id/reservation/cancel', auth, requireRoles('ngo'), requireVerifiedNgo, asyncHandler(cancelReservation));
router.post('/:id/reservation/complete', auth, requireRoles('donor'), asyncHandler(completeReservation));

router.get('/:id', auth, asyncHandler(getDonationById));

module.exports = router;
module.exports.DonationCreateSchema = DonationCreateSchema;
module.exports.DonationUpdateSchema = DonationUpdateSchema;
