const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const { auth } = require('../middleware/auth');
const { requireRoles } = require('../middleware/role');
const { validate } = require('../middleware/validate');
const {
  listUsers, getUser, setUserActive, listPartners, listNgos, listImpact, getStats,
} = require('../controllers/admin.controller');

const router = express.Router();
const UserActiveSchema = z.object({ isActive: z.boolean() }).strict();

router.use(auth, requireRoles('admin'));
router.get('/stats', asyncHandler(getStats));
router.get('/impact', asyncHandler(listImpact));
router.get('/users', asyncHandler(listUsers));
router.get('/users/:id', asyncHandler(getUser));
router.patch('/users/:id/active', validate(UserActiveSchema), asyncHandler(setUserActive));
router.get('/partners', asyncHandler(listPartners));
router.get('/ngos', asyncHandler(listNgos));

module.exports = router;
