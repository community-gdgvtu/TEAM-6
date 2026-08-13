const mongoose = require('mongoose');
const User = require('../models/User');
const Partner = require('../models/Partner');
const Ngo = require('../models/Ngo');
const Donation = require('../models/Donation');
const Impact = require('../models/Impact');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id));
const PROFILE_STATUSES = ['Pending', 'Verified', 'Rejected'];

const parsePaging = (query = {}) => {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('page and limit are invalid');
  }
  return { page, limit };
};

const listUsers = async (req, res) => {
  const filter = {};
  if (req.query.role !== undefined) {
    if (!User.ROLES.includes(req.query.role)) {
      return res.status(400).json({ error: { message: 'role is invalid', code: 'validation_error' } });
    }
    filter.role = req.query.role;
  }
  if (req.query.isActive !== undefined) {
    if (req.query.isActive !== 'true' && req.query.isActive !== 'false') {
      return res.status(400).json({ error: { message: 'isActive must be true or false', code: 'validation_error' } });
    }
    filter.isActive = req.query.isActive === 'true';
  }
  let paging;
  try { paging = parsePaging(req.query); } catch (err) {
    return res.status(400).json({ error: { message: err.message, code: 'validation_error' } });
  }
  const { page, limit } = paging;
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  return res.json({ data: { users, page, limit, total } });
};

const getUser = async (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: { message: 'Invalid user id', code: 'validation_error' } });
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: { message: 'User not found', code: 'not_found' } });
  return res.json({ data: user });
};

const setUserActive = async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: { message: 'Invalid user id', code: 'validation_error' } });
  }
  if (String(id) === String(req.user._id)) {
    return res.status(403).json({ error: { message: 'Administrators cannot change their own active state', code: 'self_management_forbidden' } });
  }
  const target = await User.findById(id);
  if (!target) return res.status(404).json({ error: { message: 'User not found', code: 'not_found' } });
  if (!isActive && target.role === 'admin' && target.isActive) {
    const activeAdmins = await User.countDocuments({ role: 'admin', isActive: true });
    if (activeAdmins <= 1) {
      return res.status(409).json({ error: { message: 'Cannot disable the last active administrator', code: 'last_admin_forbidden' } });
    }
  }
  target.isActive = isActive;
  await target.save();
  return res.json({ data: target });
};

const listProfiles = (Model, label) => async (req, res) => {
  const filter = {};
  if (req.query.status !== undefined) {
    if (!PROFILE_STATUSES.includes(req.query.status)) {
      return res.status(400).json({ error: { message: 'status is invalid', code: 'validation_error' } });
    }
    filter.status = req.query.status;
  }
  let paging;
  try { paging = parsePaging(req.query); } catch (err) {
    return res.status(400).json({ error: { message: err.message, code: 'validation_error' } });
  }
  const { page, limit } = paging;
  const [profiles, total] = await Promise.all([
    Model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Model.countDocuments(filter),
  ]);
  return res.json({ data: { [label]: profiles, page, limit, total } });
};

const listImpact = async (req, res) => {
  let paging;
  try { paging = parsePaging(req.query); } catch (err) {
    return res.status(400).json({ error: { message: err.message, code: 'validation_error' } });
  }
  const { page, limit } = paging;
  const [records, total] = await Promise.all([
    Impact.find({}).sort({ completedAt: -1 }).skip((page - 1) * limit).limit(limit),
    Impact.countDocuments({}),
  ]);
  return res.json({ data: { records, page, limit, total } });
};

const getStats = async (_req, res) => {
  const [impactSummary, categoryBreakdown, donationStatuses, userRoles, partnerStatuses, ngoStatuses] = await Promise.all([
    Impact.aggregate([{
      $group: {
        _id: null,
        completedDonations: { $sum: 1 },
        quantityRescued: { $sum: '$quantity' },
        estimatedValueRescued: { $sum: '$estimatedValue' },
      },
    }]),
    Impact.aggregate([{ $group: { _id: '$category', count: { $sum: 1 }, quantity: { $sum: '$quantity' } } }, { $sort: { _id: 1 } }]),
    Donation.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    Partner.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Ngo.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  const summary = impactSummary[0] || { completedDonations: 0, quantityRescued: 0, estimatedValueRescued: 0 };
  delete summary._id;
  return res.json({
    data: {
      impact: summary,
      categoryBreakdown,
      donationStatuses,
      userRoles,
      partnerStatuses,
      ngoStatuses,
    },
  });
};

module.exports = {
  listUsers,
  getUser,
  setUserActive,
  listPartners: listProfiles(Partner, 'partners'),
  listNgos: listProfiles(Ngo, 'ngos'),
  listImpact,
  getStats,
};
