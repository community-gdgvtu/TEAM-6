// /api/auth — register, login, /me.
//
// Public: POST /register, POST /login
// Protected: GET /me  (requires `auth` middleware)

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { auth } = require('../middleware/auth');
const { register, login, me } = require('../controllers/auth.controller');

const router = express.Router();

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.get('/me', auth, asyncHandler(me));

module.exports = router;