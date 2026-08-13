// Donation controller.
//
// Phase 4 implements:
//   POST /api/donations    -> createDonation
//   GET  /api/donations/:id -> getDonationById
//
// Visibility on GET /:id: any authenticated user can fetch by id in Phase 4.
// (Tighter visibility rules land in Phase 5 with the donor-owner and admin
// paths. NGO reservation visibility lands with reservations in Phase 6.)

const mongoose = require('mongoose');
const Donation = require('../models/Donation');
const Impact = require('../models/Impact');
const { CATEGORIES } = require('../constants/categories');
const { removeUploadedFile } = require('../middleware/upload');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id));
const isOwner = (donation, userId) => String(donation.donorId) === String(userId);
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const invalidId = (res) => res.status(400).json({
  error: { message: 'Invalid donation id', code: 'validation_error' },
});

const notFound = (res) => res.status(404).json({
  error: { message: 'Donation not found', code: 'not_found' },
});

const parseNumber = (value, name, { min, max, integer = false } = {}) => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed)) ||
      (min !== undefined && parsed < min) || (max !== undefined && parsed > max)) {
    throw new Error(`${name} is invalid`);
  }
  return parsed;
};

const buildBrowseFilter = (query = {}, requireLocation = false) => {
  const filter = { status: 'active', expiry: { $gt: new Date() } };
  if (query.category !== undefined) {
    if (!CATEGORIES.includes(query.category)) throw new Error('category is invalid');
    filter.category = query.category;
  }
  if (query.q !== undefined) {
    const term = String(query.q).trim();
    if (term.length > 100) throw new Error('q must be at most 100 characters');
    if (term) {
      filter.$or = [
        { title: { $regex: escapeRegex(term), $options: 'i' } },
        { description: { $regex: escapeRegex(term), $options: 'i' } },
      ];
    }
  }
  const hasLat = query.lat !== undefined;
  const hasLng = query.lng !== undefined;
  if (requireLocation && (!hasLat || !hasLng)) throw new Error('lat and lng are required');
  if (hasLat !== hasLng) throw new Error('lat and lng must be supplied together');
  if (hasLat) {
    const lat = parseNumber(query.lat, 'lat', { min: -90, max: 90 });
    const lng = parseNumber(query.lng, 'lng', { min: -180, max: 180 });
    const radius = parseNumber(query.radiusMeters ?? 10000, 'radiusMeters', { min: 1, max: 50000, integer: true });
    filter.location = { $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: radius } };
  }
  return filter;
};

const queryPaging = (query = {}) => ({
  page: parseNumber(query.page ?? 1, 'page', { min: 1, max: 100000, integer: true }),
  limit: parseNumber(query.limit ?? 20, 'limit', { min: 1, max: 100, integer: true }),
});

// POST /api/donations
const createDonation = async (req, res) => {
  // Build the donation body explicitly — never spread req.body, since that
  // would let an attacker inject fields like `donorId`, `status`, etc.
  const body = req.body || {};
  const {
    title,
    description,
    category,
    quantity,
    unit,
    expiry,
    pickupAddress,
    location,
    estimatedValue,
  } = body;

  const doc = {
    donorId: req.user._id, // server-set from JWT
    title,
    description: description || '',
    category,
    quantity,
    unit,
    expiry: new Date(expiry), // Zod coerce produces a Date; defensive re-wrap
    pickupAddress,
    location: {
      type: 'Point',
      coordinates: [location.coordinates[0], location.coordinates[1]],
    },
    estimatedValue: estimatedValue ?? 0,
    imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
    status: 'active',
  };

  try {
    const donation = await Donation.create(doc);
    return res.status(201).json({ data: donation });
  } catch (err) {
    removeUploadedFile(req.file);
    if (err && err.name === 'ValidationError') {
      const message = Object.values(err.errors)[0]?.message || 'Invalid input';
      return res.status(400).json({ error: { message, code: 'validation_error' } });
    }
    throw err;
  }
};

// GET /api/donations/:id
const getDonationById = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) return invalidId(res);
  const donation = await Donation.findById(id);
  if (!donation) {
    return notFound(res);
  }
  return res.json({ data: donation });
};

const listDonations = async (req, res) => {
  let filter;
  let paging;
  try {
    filter = buildBrowseFilter(req.query, req.path === '/nearby');
    paging = queryPaging(req.query);
  } catch (err) {
    return res.status(400).json({ error: { message: err.message, code: 'validation_error' } });
  }
  const { page, limit } = paging;
  const query = Donation.find(filter).skip((page - 1) * limit).limit(limit);
  if (!filter.location) query.sort(req.query.sort === 'expiry' ? { expiry: 1 } : { createdAt: -1 });
  const donations = await query;
  const total = filter.location ? undefined : await Donation.countDocuments(filter);
  return res.json({ data: { donations, page, limit, ...(total !== undefined ? { total } : {}) } });
};

const listMyDonations = async (req, res) => {
  const donations = await Donation.find({ donorId: req.user._id }).sort({ createdAt: -1 });
  return res.json({ data: donations });
};

const updateDonation = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) return invalidId(res);
  const donation = await Donation.findById(id);
  if (!donation) return notFound(res);
  if (!isOwner(donation, req.user._id)) {
    return res.status(403).json({ error: { message: 'You do not own this donation', code: 'forbidden' } });
  }
  if (donation.status !== 'active') {
    return res.status(409).json({ error: { message: 'Only active donations can be edited', code: 'invalid_status' } });
  }
  const fields = ['title', 'description', 'category', 'quantity', 'unit', 'expiry', 'pickupAddress', 'estimatedValue'];
  for (const field of fields) if (req.body[field] !== undefined) donation[field] = req.body[field];
  if (req.body.location) donation.location = { type: 'Point', coordinates: req.body.location.coordinates };
  await donation.save();
  return res.json({ data: donation });
};

const changeDonationStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!isValidObjectId(id)) return invalidId(res);
  // Completion is part of the reservation lifecycle and must use its atomic
  // compare-and-set guard rather than a read/save sequence.
  if (status === 'completed') return completeReservation(req, res);

  const donation = await Donation.findOneAndUpdate(
    { _id: id, donorId: req.user._id, status: 'active' },
    { $set: { status: 'cancelled' } },
    { new: true, runValidators: true },
  );
  if (donation) return res.json({ data: donation });

  const existing = await Donation.findById(id);
  if (!existing) return notFound(res);
  if (!isOwner(existing, req.user._id)) {
    return res.status(403).json({ error: { message: 'You do not own this donation', code: 'forbidden' } });
  }
  return res.status(409).json({ error: { message: 'Invalid donation status transition', code: 'invalid_status_transition' } });
};

const deleteDonation = async (req, res) => {
  if (!isValidObjectId(req.params.id)) return invalidId(res);
  const donation = await Donation.findByIdAndDelete(req.params.id);
  if (!donation) return notFound(res);
  return res.status(204).send();
};

const reservationFailure = async (id, res, message) => {
  const donation = await Donation.findById(id);
  if (!donation) return notFound(res);
  return res.status(409).json({ error: { message, code: 'reservation_unavailable' } });
};

const reserveDonation = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) return invalidId(res);
  const donation = await Donation.findOneAndUpdate(
    { _id: id, status: 'active', expiry: { $gt: new Date() } },
    { $set: { status: 'reserved', reservedByNgoId: req.ngo._id } },
    { new: true, runValidators: true },
  );
  if (!donation) return reservationFailure(id, res, 'Donation is no longer available for reservation');
  return res.json({ data: donation });
};

const cancelReservation = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) return invalidId(res);
  const donation = await Donation.findOneAndUpdate(
    { _id: id, status: 'reserved', reservedByNgoId: req.ngo._id },
    { $set: { status: 'active', reservedByNgoId: null } },
    { new: true, runValidators: true },
  );
  if (!donation) return reservationFailure(id, res, 'Reservation cannot be cancelled by this NGO');
  return res.json({ data: donation });
};

const completeReservation = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) return invalidId(res);
  const donation = await Donation.findOneAndUpdate(
    { _id: id, status: 'reserved', donorId: req.user._id },
    { $set: { status: 'completed' } },
    { new: true, runValidators: true },
  );
  if (!donation) return reservationFailure(id, res, 'Reservation cannot be completed by this donor');
  try {
    await Impact.create({
      donationId: donation._id,
      donorId: donation.donorId,
      ngoId: donation.reservedByNgoId,
      category: donation.category,
      quantity: donation.quantity,
      unit: donation.unit,
      estimatedValue: donation.estimatedValue,
      completedAt: new Date(),
    });
  } catch (err) {
    // Preserve the all-or-nothing handoff outcome without requiring MongoDB
    // transactions (Atlas free tiers may not expose them). A duplicate means
    // a legacy/retry record already exists, so the completed state is valid.
    if (err && err.code !== 11000) {
      await Donation.findOneAndUpdate(
        { _id: id, status: 'completed', reservedByNgoId: donation.reservedByNgoId },
        { $set: { status: 'reserved' } },
      );
      throw err;
    }
  }
  return res.json({ data: donation });
};

const listMyReservations = async (req, res) => {
  const donations = await Donation.find({ reservedByNgoId: req.ngo._id, status: 'reserved' }).sort({ expiry: 1 });
  return res.json({ data: donations });
};

module.exports = {
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
  buildBrowseFilter,
  CATEGORIES,
};
