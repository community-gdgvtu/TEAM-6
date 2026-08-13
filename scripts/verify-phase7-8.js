// Dependency-free Phase 7 + 8 smoke checks.

const assert = require('assert');
const Donation = require('../src/models/Donation');
const Impact = require('../src/models/Impact');
const User = require('../src/models/User');
const Partner = require('../src/models/Partner');
const Ngo = require('../src/models/Ngo');
const adminRouter = require('../src/routes/admin.routes');
const impactRouter = require('../src/routes/impact.routes');
const { completeReservation } = require('../src/controllers/donation.controller');
const { listMyDonorImpact, listMyNgoImpact } = require('../src/controllers/impact.controller');
const { listUsers, setUserActive, getStats } = require('../src/controllers/admin.controller');

const ID = '507f1f77bcf86cd799439011';

const response = () => {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

const queryResult = (value) => ({
  sort() { return this; }, skip() { return this; }, limit() { return this; },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
});

(async () => {
  const indexes = Impact.schema.indexes();
  assert(indexes.some(([keys, options]) => keys.donationId === 1 && options.unique));
  assert(indexes.some(([keys]) => keys.donorId === 1 && keys.completedAt === -1));
  console.log('PASS  impact model enforces one immutable record per donation with dashboard indexes');

  const original = {
    donationFindOneAndUpdate: Donation.findOneAndUpdate,
    impactCreate: Impact.create,
    impactFind: Impact.find,
    impactAggregate: Impact.aggregate,
    userFind: User.find,
    userFindById: User.findById,
    userCount: User.countDocuments,
    userAggregate: User.aggregate,
    donationAggregate: Donation.aggregate,
    partnerAggregate: Partner.aggregate,
    ngoAggregate: Ngo.aggregate,
  };
  try {
    const calls = [];
    Donation.findOneAndUpdate = async (...args) => {
      calls.push(args);
      return {
        _id: ID, donorId: 'donor-1', reservedByNgoId: 'ngo-profile-1',
        category: 'bakery', quantity: 12, unit: 'meals', estimatedValue: 300,
      };
    };
    let createdImpact;
    Impact.create = async (doc) => { createdImpact = doc; return { _id: 'impact-1', ...doc }; };
    let res = response();
    await completeReservation({ params: { id: ID }, user: { _id: 'donor-1' } }, res);
    assert.strictEqual(calls[0][0].status, 'reserved');
    assert.strictEqual(calls[0][0].donorId, 'donor-1');
    assert.deepStrictEqual(createdImpact.donationId, ID);
    assert.strictEqual(createdImpact.ngoId, 'ngo-profile-1');
    assert.strictEqual(createdImpact.quantity, 12);
    console.log('PASS  completing a reservation writes the linked impact record');

    // A failed non-duplicate impact write restores the prior reservation.
    calls.length = 0;
    Impact.create = async () => { throw new Error('impact write failed'); };
    let threw = false;
    try { await completeReservation({ params: { id: ID }, user: { _id: 'donor-1' } }, response()); } catch { threw = true; }
    assert.strictEqual(threw, true);
    assert.strictEqual(calls[1][0].status, 'completed');
    assert.strictEqual(calls[1][1].$set.status, 'reserved');
    console.log('PASS  failed impact persistence compensates the completion transition');

    Impact.find = (filter) => queryResult([{ filter }]);
    res = response();
    await listMyDonorImpact({ user: { _id: 'donor-1' } }, res);
    assert.strictEqual(res.body.data[0].filter.donorId, 'donor-1');
    res = response();
    await listMyNgoImpact({ ngo: { _id: 'ngo-profile-1' } }, res);
    assert.strictEqual(res.body.data[0].filter.ngoId, 'ngo-profile-1');
    console.log('PASS  donor and verified-NGO impact views are scoped to their own records');

    let userFilter;
    User.find = (filter) => { userFilter = filter; return queryResult([{ _id: 'u1' }]); };
    User.countDocuments = async () => 1;
    res = response();
    await listUsers({ query: { role: 'donor', isActive: 'true', page: '1', limit: '10' } }, res);
    assert.deepStrictEqual(userFilter, { role: 'donor', isActive: true });
    assert.strictEqual(res.body.data.total, 1);
    console.log('PASS  admin user listing filters roles and active state');

    const target = { _id: 'u2', role: 'donor', isActive: true, saves: 0, async save() { this.saves += 1; } };
    User.findById = async () => target;
    res = response();
    await setUserActive({ params: { id: ID }, user: { _id: 'admin-1' }, body: { isActive: false } }, res);
    assert.strictEqual(target.isActive, false);
    assert.strictEqual(target.saves, 1);

    res = response();
    await setUserActive({ params: { id: ID }, user: { _id: ID }, body: { isActive: false } }, res);
    assert.strictEqual(res.statusCode, 403);
    console.log('PASS  admin account management deactivates accounts but blocks self-lockout');

    const aggregates = [
      [{ _id: null, completedDonations: 2, quantityRescued: 22, estimatedValueRescued: 450 }],
      [{ _id: 'bakery', count: 2, quantity: 22 }],
      [{ _id: 'completed', count: 2 }],
      [{ _id: 'donor', count: 3 }],
      [{ _id: 'Verified', count: 2 }],
      [{ _id: 'Verified', count: 1 }],
    ];
    Impact.aggregate = async () => aggregates.shift();
    Donation.aggregate = async () => aggregates.shift();
    User.aggregate = async () => aggregates.shift();
    Partner.aggregate = async () => aggregates.shift();
    Ngo.aggregate = async () => aggregates.shift();
    res = response();
    await getStats({}, res);
    assert.deepStrictEqual(res.body.data.impact, { completedDonations: 2, quantityRescued: 22, estimatedValueRescued: 450 });
    assert.strictEqual(res.body.data.categoryBreakdown[0]._id, 'bakery');
    console.log('PASS  admin statistics aggregate impact, donation, user, and verification data');
  } finally {
    Donation.findOneAndUpdate = original.donationFindOneAndUpdate;
    Impact.create = original.impactCreate;
    Impact.find = original.impactFind;
    Impact.aggregate = original.impactAggregate;
    User.find = original.userFind;
    User.findById = original.userFindById;
    User.countDocuments = original.userCount;
    User.aggregate = original.userAggregate;
    Donation.aggregate = original.donationAggregate;
    Partner.aggregate = original.partnerAggregate;
    Ngo.aggregate = original.ngoAggregate;
  }

  const paths = (router) => router.stack.filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route.methods).join(',').toUpperCase()} ${layer.route.path}`);
  const adminPaths = paths(adminRouter);
  for (const path of ['GET /stats', 'GET /impact', 'GET /users', 'PATCH /users/:id/active', 'GET /partners', 'GET /ngos']) {
    assert(adminPaths.includes(path), `Missing admin route: ${path}`);
  }
  const impactPaths = paths(impactRouter);
  assert(impactPaths.includes('GET /mine'));
  assert(impactPaths.includes('GET /received'));
  console.log('PASS  Phase 7 and 8 routes are registered');
  console.log('\nAll Phase 7 + 8 smoke checks passed.');
})().catch((err) => {
  console.error('[verify:phase7-8] FAILED:', err);
  process.exitCode = 1;
});
