// Auth middleware — verifies the JWT and attaches the user to req.user.
//
// Behavior:
//   - No Authorization header  → 401 (use `optionalAuth` for public routes)
//   - Malformed / bad token    → 401
//   - Valid token, user missing → 401 (token references a deleted user)
//   - Valid token, user found   → req.user = user doc (password stripped
//                                  by the model's transform)
//
// We re-query the DB on every request rather than trusting the token's
// `sub`/`role` claims alone. Cheap (single indexed lookup) and avoids
// stale-role bugs after a role change.

const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res
        .status(401)
        .json({ error: { message: 'Authentication required', code: 'unauthenticated' } });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return res
        .status(401)
        .json({ error: { message: 'Invalid or expired token', code: 'invalid_token' } });
    }

    const user = await User.findById(decoded.sub);
    if (!user) {
      return res
        .status(401)
        .json({ error: { message: 'User not found', code: 'unauthenticated' } });
    }
    // Existing accounts created before Phase 8 have no isActive field. Treat
    // only an explicit false as disabled so the rollout is backward-compatible.
    if (user.isActive === false) {
      return res.status(403).json({
        error: { message: 'Account is disabled', code: 'account_disabled' },
      });
    }

    req.user = user;
    req.userId = String(user._id);
    next();
  } catch (err) {
    next(err);
  }
};

// Optional auth: tries to populate req.user if a valid token is present,
// otherwise just calls next(). Use this on routes that are public but
// benefit from knowing who's calling (e.g. browse listings).

const optionalAuth = async (req, _res, next) => {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return next();

    try {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.sub);
      if (user && user.isActive !== false) {
        req.user = user;
        req.userId = String(user._id);
      }
    } catch {
      // Swallow — optional auth never errors out.
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { auth, optionalAuth };
