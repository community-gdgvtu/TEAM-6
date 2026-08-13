// One-off: seed an admin user so the Phase 3 verification matrix has someone
// to act as the admin (since /api/auth/register rejects `admin` role).
//
// Run: node scripts/seed-admin-once.js
// Admin email: admin@taki.test / password: adminpass1
// Idempotent — does nothing if an admin with that email already exists.

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const { hashPassword } = require('../src/utils/password');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const email = 'admin@taki.test';
    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`[seed-admin] Admin already exists: id=${existing._id} role=${existing.role}`);
    } else {
      const hashed = await hashPassword('adminpass1');
      const admin = await User.create({
        name: 'TAKI Admin',
        email,
        password: hashed,
        role: 'admin',
      });
      console.log(`[seed-admin] Created admin: id=${admin._id} email=${admin.email}`);
    }
  } catch (err) {
    console.error('[seed-admin] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();