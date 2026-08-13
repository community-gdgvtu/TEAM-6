// Real MongoDB + HTTP end-to-end verification. It creates uniquely named test
// data through the public API, then removes only those exact records.
// Run: npm run verify:e2e (requires MONGODB_URI and JWT_SECRET in .env)

require('dotenv').config();
process.env.NODE_ENV = 'test';
const mongoose = require('mongoose');
const app = require('../src/app');
const { validateRuntimeConfig } = require('../src/config/env');
const User = require('../src/models/User');
const Partner = require('../src/models/Partner');
const Ngo = require('../src/models/Ngo');
const Donation = require('../src/models/Donation');
const Impact = require('../src/models/Impact');
const { hashPassword } = require('../src/utils/password');

const suffix = `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const password = 'E2eDemoPass123!';
const emails = {
  admin: `admin-${suffix}@taki.test`, donor: `donor-${suffix}@taki.test`, ngo: `ngo-${suffix}@taki.test`,
};
const created = { userIds: [], donationIds: [], impactIds: [], partnerIds: [], ngoIds: [] };

const fail = (message) => { throw new Error(message); };

const api = async (port, method, pathname, body, token) => {
  const res = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = res.status === 204 ? null : await res.json();
  if (!res.ok) fail(`${method} ${pathname} failed (${res.status}): ${JSON.stringify(json)}`);
  return json;
};

(async () => {
  let server;
  try {
    const { mongoUri } = validateRuntimeConfig();
    await mongoose.connect(mongoUri);
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const port = server.address().port;

    const admin = await User.create({
      name: 'E2E Admin', email: emails.admin, role: 'admin', isActive: true,
      password: await hashPassword(password),
    });
    created.userIds.push(admin._id);
    const adminToken = (await api(port, 'POST', '/api/auth/login', { email: emails.admin, password })).data.token;

    const donorLogin = (await api(port, 'POST', '/api/auth/register', {
      name: 'E2E Donor', email: emails.donor, password, role: 'donor',
    })).data;
    const ngoLogin = (await api(port, 'POST', '/api/auth/register', {
      name: 'E2E NGO', email: emails.ngo, password, role: 'ngo',
    })).data;
    created.userIds.push(donorLogin.user._id, ngoLogin.user._id);

    const partner = (await api(port, 'POST', '/api/partners/register', {
      businessName: 'E2E Kitchen', businessType: 'restaurant', businessLicense: `LIC-${suffix}`,
      address: '12 E2E Market Street', contactNumber: '+919111111111',
    }, donorLogin.token)).data;
    created.partnerIds.push(partner._id);
    const ngo = (await api(port, 'POST', '/api/ngos/register', {
      ngoName: 'E2E Relief Network', registrationNumber: `NGO-${suffix}`, address: '45 E2E Service Road',
      contactNumber: '+919222222222', focalPersonName: 'E2E Coordinator', focalPersonContact: '+919333333333',
    }, ngoLogin.token)).data;
    created.ngoIds.push(ngo._id);
    await api(port, 'PATCH', `/api/partners/${partner._id}/verify`, { status: 'Verified' }, adminToken);
    await api(port, 'PATCH', `/api/ngos/${ngo._id}/verify`, { status: 'Verified' }, adminToken);

    const donation = (await api(port, 'POST', '/api/donations', {
      title: 'E2E Fresh Meals', description: 'Full flow verification', category: 'prepared-meals', quantity: 10,
      unit: 'meals', expiry: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      pickupAddress: '12 E2E Market Street', location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      estimatedValue: 1000,
    }, donorLogin.token)).data;
    created.donationIds.push(donation._id);
    const browse = await api(port, 'GET', '/api/donations/nearby?lat=12.9716&lng=77.5946&radiusMeters=1000');
    if (!browse.data.donations.some((item) => item._id === donation._id)) fail('Nearby browsing did not return created donation');

    const reserved = (await api(port, 'POST', `/api/donations/${donation._id}/reserve`, {}, ngoLogin.token)).data;
    if (reserved.status !== 'reserved') fail('Donation was not reserved');
    const completed = (await api(port, 'POST', `/api/donations/${donation._id}/reservation/complete`, {}, donorLogin.token)).data;
    if (completed.status !== 'completed') fail('Donation was not completed');
    const donorImpact = await api(port, 'GET', '/api/impact/mine', undefined, donorLogin.token);
    const impact = donorImpact.data.find((item) => String(item.donationId) === donation._id);
    if (!impact) fail('Impact record was not returned to donor');
    created.impactIds.push(impact._id);
    const stats = await api(port, 'GET', '/api/admin/stats', undefined, adminToken);
    if (stats.data.impact.completedDonations < 1) fail('Admin impact statistics are unavailable');
    console.log('PASS  real HTTP + MongoDB flow: donor -> verification -> donation -> NGO reservation -> completion -> impact');
  } catch (err) {
    console.error('[verify:e2e] FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState === 1) {
      await Impact.deleteMany({ _id: { $in: created.impactIds } });
      await Impact.deleteMany({ donationId: { $in: created.donationIds } });
      await Donation.deleteMany({ _id: { $in: created.donationIds } });
      await Partner.deleteMany({ _id: { $in: created.partnerIds } });
      await Ngo.deleteMany({ _id: { $in: created.ngoIds } });
      await User.deleteMany({ _id: { $in: created.userIds } });
      await mongoose.disconnect();
    }
    if (server) await new Promise((resolve) => server.close(resolve));
  }
})();
