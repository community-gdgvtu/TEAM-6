// Auth controller — register, login, /me.
// Roles: donor | ngo | admin. Admin is not self-registerable.

const User = require('../models/User');
const { hashPassword, comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');

const DUPLICATE_KEY_CODE = 11000;

// Strip the password just in case the model's transform isn't applied
// (e.g. if we ever select('+password')).
const safeUser = (user) => {
  if (!user) return null;
  const obj = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  delete obj.password;
  return obj;
};

const register = async (req, res) => {
  const { name, email, password, role } = req.body || {};

  if (!name || !email || !password || !role) {
    return res.status(400).json({
      error: { message: 'name, email, password, and role are required', code: 'bad_request' },
    });
  }

  // Defense in depth: role whitelist enforced here too, not just in the schema.
  // Admin must be created via the seed script, never via public registration.
  const allowedRoles = User.ROLES.filter((r) => r !== 'admin');
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({
      error: {
        message: `role must be one of: ${allowedRoles.join(', ')}`,
        code: 'invalid_role',
      },
    });
  }

  const hashed = await hashPassword(password);

  let user;
  try {
    user = await User.create({ name, email, password: hashed, role });
  } catch (err) {
    if (err && err.code === DUPLICATE_KEY_CODE) {
      return res
        .status(409)
        .json({ error: { message: 'Email already in use', code: 'email_taken' } });
    }
    // Mongoose validation errors → 400 with the first message.
    if (err && err.name === 'ValidationError') {
      const message = Object.values(err.errors)[0]?.message || 'Invalid input';
      return res.status(400).json({ error: { message, code: 'validation_error' } });
    }
    throw err;
  }

  const token = signToken({ userId: user._id, role: user.role });
  return res.status(201).json({ data: { user: safeUser(user), token } });
};

const login = async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({
      error: { message: 'email and password are required', code: 'bad_request' },
    });
  }

  // Password is `select: false` on the model, so we explicitly select it.
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  if (!user) {
    // Generic message — don't leak whether the email exists.
    return res
      .status(401)
      .json({ error: { message: 'Invalid email or password', code: 'invalid_credentials' } });
  }

  const ok = await comparePassword(password, user.password);
  if (!ok) {
    return res
      .status(401)
      .json({ error: { message: 'Invalid email or password', code: 'invalid_credentials' } });
  }

  const token = signToken({ userId: user._id, role: user.role });
  return res.json({ data: { user: safeUser(user), token } });
};

const me = async (req, res) => {
  // req.user is populated by the `auth` middleware.
  return res.json({ data: safeUser(req.user) });
};

module.exports = { register, login, me };