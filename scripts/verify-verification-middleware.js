// One-off verification of the Phase 3 verification middleware.
// Run: node scripts/verify-verification-middleware.js
//
// Asserts:
//   - requireVerifiedPartner: missing profile  -> 403 partner_profile_required
//   - requireVerifiedPartner: Pending profile  -> 403 partner_not_verified
//   - requireVerifiedPartner: Rejected profile -> 403 partner_not_verified
//   - requireVerifiedPartner: Verified profile -> passes (req.partner set)
//   - requireVerifiedNgo: same matrix

const assert = require('assert');
const { requireVerifiedPartner, requireVerifiedNgo } = require('../src/middleware/verification');

const mockRes = () => {
  const res = {};
  res.status = (code) => { res._status = code; return res; };
  res.json = (body) => { res._body = body; return res; };
  return res;
};

const run = async (mw, req) => {
  const res = mockRes();
  let called = false;
  const next = () => { called = true; };
  await mw(req, res, next);
  return { status: res._status, body: res._body, nextCalled: called };
};

// Helper: replace the model's findOne with a stub, run, then restore.
const withStub = (Model, findOneResult, fn) => {
  const original = Model.findOne;
  Model.findOne = async () => findOneResult;
  return Promise.resolve(fn()).finally(() => { Model.findOne = original; });
};

const Partner = require('../src/models/Partner');
const Ngo = require('../src/models/Ngo');

const baseUser = (role) => ({ _id: 'u1', role });
const partnerProfile = (status) => ({ status, _id: 'p1' });
const ngoProfile = (status) => ({ status, _id: 'n1' });

(async () => {
  // requireVerifiedPartner
  await withStub(Partner, null, async () => {
    const out = await run(requireVerifiedPartner, { user: baseUser('donor') });
    assert.strictEqual(out.status, 403);
    assert.strictEqual(out.body.error.code, 'partner_profile_required');
    console.log('PASS  requireVerifiedPartner: missing profile → 403 partner_profile_required');
  });

  await withStub(Partner, partnerProfile('Pending'), async () => {
    const out = await run(requireVerifiedPartner, { user: baseUser('donor') });
    assert.strictEqual(out.status, 403);
    assert.strictEqual(out.body.error.code, 'partner_not_verified');
    console.log('PASS  requireVerifiedPartner: Pending → 403 partner_not_verified');
  });

  await withStub(Partner, partnerProfile('Rejected'), async () => {
    const out = await run(requireVerifiedPartner, { user: baseUser('donor') });
    assert.strictEqual(out.status, 403);
    assert.strictEqual(out.body.error.code, 'partner_not_verified');
    console.log('PASS  requireVerifiedPartner: Rejected → 403 partner_not_verified');
  });

  await withStub(Partner, partnerProfile('Verified'), async () => {
    const req = { user: baseUser('donor') };
    const out = await run(requireVerifiedPartner, req);
    assert.strictEqual(out.nextCalled, true);
    assert.strictEqual(req.partner.status, 'Verified');
    console.log('PASS  requireVerifiedPartner: Verified → next() + req.partner set');
  });

  // requireVerifiedNgo (mirror)
  await withStub(Ngo, null, async () => {
    const out = await run(requireVerifiedNgo, { user: baseUser('ngo') });
    assert.strictEqual(out.status, 403);
    assert.strictEqual(out.body.error.code, 'ngo_profile_required');
    console.log('PASS  requireVerifiedNgo: missing profile → 403 ngo_profile_required');
  });

  await withStub(Ngo, ngoProfile('Pending'), async () => {
    const out = await run(requireVerifiedNgo, { user: baseUser('ngo') });
    assert.strictEqual(out.status, 403);
    assert.strictEqual(out.body.error.code, 'ngo_not_verified');
    console.log('PASS  requireVerifiedNgo: Pending → 403 ngo_not_verified');
  });

  await withStub(Ngo, ngoProfile('Rejected'), async () => {
    const out = await run(requireVerifiedNgo, { user: baseUser('ngo') });
    assert.strictEqual(out.status, 403);
    assert.strictEqual(out.body.error.code, 'ngo_not_verified');
    console.log('PASS  requireVerifiedNgo: Rejected → 403 ngo_not_verified');
  });

  await withStub(Ngo, ngoProfile('Verified'), async () => {
    const req = { user: baseUser('ngo') };
    const out = await run(requireVerifiedNgo, req);
    assert.strictEqual(out.nextCalled, true);
    assert.strictEqual(req.ngo.status, 'Verified');
    console.log('PASS  requireVerifiedNgo: Verified → next() + req.ngo set');
  });

  console.log('\nAll verification middleware assertions passed.');
})();