// JWT helpers. Single place that knows how we sign and verify tokens.
//
// Claims:
//   sub  — user id
//   role — denormalized into the token so middleware can do role checks
//          without a DB hit. Trust it only as a hint — the auth middleware
//          still attaches the full user document for anything sensitive.
//   iat / exp — set by jsonwebtoken (sign with expiresIn).

const jwt = require('jsonwebtoken');

const env = require('../config/env');

const JWT_SECRET = () => {
  const s = env.JWT_SECRET;
  if (!s) {
    throw Object.assign(new Error('JWT_SECRET is not configured'), {
      status: 500,
      code: 'jwt_misconfigured',
    });
  }
  return s;
};

const signToken = ({ userId, role }) =>
  jwt.sign({ sub: String(userId), role }, JWT_SECRET(), {
    expiresIn: env.JWT_EXPIRES_IN || '7d',
  });

const verifyToken = (token) => jwt.verify(token, JWT_SECRET());

module.exports = { signToken, verifyToken };