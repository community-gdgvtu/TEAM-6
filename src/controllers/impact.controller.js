const Impact = require('../models/Impact');

const listMyDonorImpact = async (req, res) => {
  const records = await Impact.find({ donorId: req.user._id }).sort({ completedAt: -1 });
  return res.json({ data: records });
};

const listMyNgoImpact = async (req, res) => {
  const records = await Impact.find({ ngoId: req.ngo._id }).sort({ completedAt: -1 });
  return res.json({ data: records });
};

module.exports = { listMyDonorImpact, listMyNgoImpact };
