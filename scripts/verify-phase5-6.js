// Dependency-free Phase 5 + 6 controller and route smoke checks.
// Run: npm run verify:phase5-6

const assert = require('assert');
const Donation = require('../src/models/Donation');
const Impact = require('../src/models/Impact');
const donationRouter = require('../src/routes/donation.routes');
const {
  buildBrowseFilter,
  listDonations,
  updateDonation,
  changeDonationStatus,
  deleteDonation,
  reserveDonation,
  cancelReservation,
  completeReservation,
  listMyReservations,
} = require('../src/controllers/donation.controller');

const ID = '507f1f77bcf86cd799439011';

const response = () => {
  const res = {};
  res.status = (status) => { res.statusCode = status; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.send = () => res;
  return res;
};

const queryResult = (result) => {
  const query = {
    sortValue: undefined,
    skipValue: undefined,
    limitValue: undefined,
    sort(value) { this.sortValue = value; return this; },
    skip(value) { this.skipValue = value; return this; },
    limit(value) { this.limitValue = value; return this; },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
  return query;
};

const donationDoc = (overrides = {}) => ({
  _id: ID,
  donorId: 'donor-1',
  status: 'active',
  reservedByNgoId: null,
  saveCalls: 0,
  async save() { this.saveCalls += 1; return this; },
  ...overrides,
});

(async () => {
  // Browse filtering: only current active donations are ever exposed publicly.
  const filter = buildBrowseFilter({
    category: 'bakery', q: 'bread.*', lat: '12.9', lng: '77.5', radiusMeters: '2500',
  });
  assert.strictEqual(filter.status, 'active');
  assert(filter.expiry.$gt instanceof Date);
  assert.strictEqual(filter.category, 'bakery');
  assert.strictEqual(filter.$or[0].title.$regex, 'bread\\.\\*');
  assert.deepStrictEqual(filter.location.$near.$geometry.coordinates, [77.5, 12.9]);
  assert.throws(() => buildBrowseFilter({ category: 'not-a-category' }));
  assert.throws(() => buildBrowseFilter({ lat: '12' }));
  assert.throws(() => buildBrowseFilter({}, true));
  console.log('PASS  browse filtering validates category/search/coordinates and limits public data to active, unexpired donations');

  const original = {
    find: Donation.find,
    findById: Donation.findById,
    countDocuments: Donation.countDocuments,
    findByIdAndDelete: Donation.findByIdAndDelete,
    findOneAndUpdate: Donation.findOneAndUpdate,
    impactCreate: Impact.create,
  };
  try {
    let findFilter;
    let browseQuery;
    Donation.find = (query) => { findFilter = query; browseQuery = queryResult([{ _id: ID }]); return browseQuery; };
    Donation.countDocuments = async () => 1;
    let res = response();
    await listDonations({ query: { page: '2', limit: '5', sort: 'expiry' }, path: '/' }, res);
    assert.strictEqual(findFilter.status, 'active');
    assert.strictEqual(browseQuery.skipValue, 5);
    assert.strictEqual(browseQuery.limitValue, 5);
    assert.deepStrictEqual(browseQuery.sortValue, { expiry: 1 });
    assert.strictEqual(res.body.data.total, 1);

    res = response();
    await listDonations({ query: { lat: '12.9', lng: '77.5' }, path: '/nearby' }, res);
    assert(findFilter.location.$near);
    assert.strictEqual(browseQuery.sortValue, undefined);
    assert.strictEqual(Object.hasOwn(res.body.data, 'total'), false);
    console.log('PASS  browse and nearby endpoints paginate safely and preserve distance ordering');

    // Donor ownership/editing and strictly valid status changes.
    let doc = donationDoc();
    Donation.findById = async () => doc;
    res = response();
    await updateDonation({ params: { id: ID }, user: { _id: 'donor-1' }, body: { title: 'Updated title' } }, res);
    assert.strictEqual(doc.title, 'Updated title');
    assert.strictEqual(doc.saveCalls, 1);
    assert.strictEqual(res.statusCode, undefined);

    doc = donationDoc({ donorId: 'someone-else' });
    Donation.findById = async () => doc;
    res = response();
    await updateDonation({ params: { id: ID }, user: { _id: 'donor-1' }, body: { title: 'Nope' } }, res);
    assert.strictEqual(res.statusCode, 403);

    doc = donationDoc({ status: 'reserved' });
    Donation.findById = async () => doc;
    res = response();
    await updateDonation({ params: { id: ID }, user: { _id: 'donor-1' }, body: { title: 'Nope' } }, res);
    assert.strictEqual(res.statusCode, 409);

    let statusCall;
    Donation.findOneAndUpdate = async (...args) => {
      statusCall = args;
      return { _id: ID, status: 'cancelled' };
    };
    res = response();
    await changeDonationStatus({ params: { id: ID }, user: { _id: 'donor-1' }, body: { status: 'cancelled' } }, res);
    assert.strictEqual(statusCall[0].status, 'active');
    assert.strictEqual(statusCall[0].donorId, 'donor-1');
    assert.strictEqual(statusCall[1].$set.status, 'cancelled');

    doc = donationDoc();
    Donation.findOneAndUpdate = async () => null;
    Donation.findById = async () => doc;
    res = response();
    await changeDonationStatus({ params: { id: ID }, user: { _id: 'donor-1' }, body: { status: 'completed' } }, res);
    assert.strictEqual(res.statusCode, 409);
    console.log('PASS  donor management enforces ownership and valid listing transitions');

    Donation.findByIdAndDelete = async () => ({ _id: ID });
    res = response();
    await deleteDonation({ params: { id: ID } }, res);
    assert.strictEqual(res.statusCode, 204);
    console.log('PASS  admin delete controller returns 204 for an existing donation');

    // Reservation lifecycle: filters are the authorization and concurrency
    // guardrails, so inspect them directly as well as their responses.
    let calls = [];
    Donation.findOneAndUpdate = async (...args) => {
      calls.push(args);
      return { _id: ID, status: args[1].$set.status, reservedByNgoId: args[1].$set.reservedByNgoId };
    };
    Impact.create = async () => ({ _id: 'impact-1' });
    res = response();
    await reserveDonation({ params: { id: ID }, ngo: { _id: 'ngo-1' } }, res);
    assert.deepStrictEqual(calls[0][0].status, 'active');
    assert(calls[0][0].expiry.$gt instanceof Date);
    assert.strictEqual(calls[0][1].$set.reservedByNgoId, 'ngo-1');
    assert.strictEqual(calls[0][2].new, true);

    res = response();
    await cancelReservation({ params: { id: ID }, ngo: { _id: 'ngo-1' } }, res);
    assert.strictEqual(calls[1][0].status, 'reserved');
    assert.strictEqual(calls[1][0].reservedByNgoId, 'ngo-1');
    assert.strictEqual(calls[1][1].$set.status, 'active');
    assert.strictEqual(calls[1][1].$set.reservedByNgoId, null);

    res = response();
    await completeReservation({ params: { id: ID }, user: { _id: 'donor-1' } }, res);
    assert.strictEqual(calls[2][0].status, 'reserved');
    assert.strictEqual(calls[2][0].donorId, 'donor-1');
    assert.strictEqual(calls[2][1].$set.status, 'completed');

    Donation.findOneAndUpdate = async () => null;
    Donation.findById = async () => ({ _id: ID, status: 'reserved' });
    res = response();
    await cancelReservation({ params: { id: ID }, ngo: { _id: 'wrong-ngo' } }, res);
    assert.strictEqual(res.statusCode, 409);
    assert.strictEqual(res.body.error.code, 'reservation_unavailable');

    Donation.find = () => queryResult([{ _id: ID, reservedByNgoId: 'ngo-1' }]);
    res = response();
    await listMyReservations({ ngo: { _id: 'ngo-1' } }, res);
    assert.deepStrictEqual(res.body.data, [{ _id: ID, reservedByNgoId: 'ngo-1' }]);
    console.log('PASS  reservation reserve/cancel/complete paths are atomic and scoped to the NGO or donor owner');
  } finally {
    Donation.find = original.find;
    Donation.findById = original.findById;
    Donation.countDocuments = original.countDocuments;
    Donation.findByIdAndDelete = original.findByIdAndDelete;
    Donation.findOneAndUpdate = original.findOneAndUpdate;
    Impact.create = original.impactCreate;
  }

  const routes = donationRouter.stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route.methods).join(',').toUpperCase()} ${layer.route.path}`);
  for (const route of [
    'GET /', 'GET /nearby', 'GET /mine', 'PATCH /:id', 'PATCH /:id/status',
    'DELETE /:id', 'POST /:id/reserve', 'POST /:id/reservation/cancel',
    'POST /:id/reservation/complete', 'GET /my-reservations',
  ]) assert(routes.includes(route), `Missing route: ${route}`);
  console.log('PASS  Phase 5 and 6 routes are registered');
  console.log('\nAll Phase 5 + 6 smoke checks passed.');
})().catch((err) => {
  console.error('[verify:phase5-6] FAILED:', err);
  process.exitCode = 1;
});
