const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { auth } = require('../middleware/auth');
const { requireRoles } = require('../middleware/role');
const { requireVerifiedNgo } = require('../middleware/verification');
const { listMyDonorImpact, listMyNgoImpact } = require('../controllers/impact.controller');

const router = express.Router();

router.get('/mine', auth, requireRoles('donor'), asyncHandler(listMyDonorImpact));
router.get('/received', auth, requireRoles('ngo'), requireVerifiedNgo, asyncHandler(listMyNgoImpact));

module.exports = router;
