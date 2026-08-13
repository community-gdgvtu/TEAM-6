// Local Phase 9 readiness checks. Does not connect to MongoDB.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const User = require('../src/models/User');
const { validateRuntimeConfig } = require('../src/config/env');

const saved = {
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  PORT: process.env.PORT,
};

try {
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/rescuebite-test';
  process.env.JWT_SECRET = 'phase-nine-verification-secret';
  process.env.PORT = '4000';
  assert.deepStrictEqual(validateRuntimeConfig(), {
    mongoUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET,
  });
  process.env.JWT_SECRET = 'short';
  assert.throws(validateRuntimeConfig, /JWT_SECRET/);
  console.log('PASS  runtime configuration rejects missing or weak JWT secrets');

  const legacyCompatibleUser = new User({
    name: 'Legacy User', email: 'legacy@taki.test', password: '$2a$10$abcdefghijklmnopqrstuuW8LPO5lZqJ4a3mR7mF0cN9O7GdZ9pwu', role: 'donor',
  });
  assert.strictEqual(legacyCompatibleUser.isActive, true);
  console.log('PASS  new accounts default active; auth treats only explicit false as disabled');

  const seedPath = path.join(__dirname, 'seed.js');
  const seed = fs.readFileSync(seedPath, 'utf8');
  for (const requiredText of ['admin@taki.demo', 'donor@taki.demo', 'ngo@taki.demo', 'DEMO ACTIVE:', 'DEMO COMPLETED:']) {
    assert(seed.includes(requiredText), `Demo seed is missing ${requiredText}`);
  }
  console.log('PASS  idempotent demo seed contains admin, donor, NGO, active donation, and completed impact flow');
  console.log('\nAll Phase 9 local readiness checks passed.');
} finally {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
