// Role-based authorization middleware.
//
// Usage:
//   router.post('/listings', auth, requireRoles('seller'), handler)
//
// Assumes `auth` ran first (req.user populated). Anyone not in the allowed
// set gets a 403 with a consistent envelope.

const requireRoles = (...allowed) => {
  if (allowed.length === 0) {
    throw new Error('requireRoles needs at least one role');
  }
  const set = new Set(allowed);
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ error: { message: 'Authentication required', code: 'unauthenticated' } });
    }
    if (!set.has(req.user.role)) {
      return res.status(403).json({
        error: {
          message: `Forbidden — requires one of: ${[...set].join(', ')}`,
          code: 'forbidden',
        },
      });
    }
    next();
  };
};

module.exports = { requireRoles };