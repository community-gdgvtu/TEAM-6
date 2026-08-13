// Password hashing helpers (bcrypt).
//
// salt rounds: 10 is the modern standard for CPU-bound bcrypt on commodity
// hardware — ~80ms per hash, fine for an MVP. Higher rounds cost more on
// every login and signup without proportionate benefit at this scale.

const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

const hashPassword = async (plain) => {
  if (typeof plain !== 'string' || plain.length < 8) {
    throw Object.assign(new Error('password must be at least 8 characters'), {
      status: 400,
      code: 'weak_password',
    });
  }
  return bcrypt.hash(plain, SALT_ROUNDS);
};

const comparePassword = async (plain, hash) => {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
};

module.exports = { hashPassword, comparePassword, SALT_ROUNDS };