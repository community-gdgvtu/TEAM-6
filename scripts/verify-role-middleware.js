// One-off verification of the role middleware with the TAKI role names.
// Run: node scripts/verify-role-middleware.js
//
// Asserts:
//   - requireRoles('donor') blocks ngo with 403
//   - requireRoles('donor') allows donor with next() called
//   - requireRoles('ngo') blocks donor with 403
//   - requireRoles('admin') blocks both donor and ngo with 403
//   - requireRoles('donor','admin') blocks ngo with 403
//   - requireRoles('ngo','admin') allows admin with next() called
//   - no req.user → 401

const assert = require('assert');
const { requireRoles } = require('../src/middleware/role');

const mockRes = () => {
  const res = {};
  res.status = (code) => {
    res._status = code;
    return res;
  };
  res.json = (body) => {
    res._body = body;
    return res;
  };
  return res;
};

const run = (mw, req) => {
  const res = mockRes();
  let called = false;
  const next = () => { called = true; };
  mw(req, res, next);
  return { status: res._status, body: res._body, nextCalled: called };
};

// 1. ngo blocked from donor route
{
  const out = run(requireRoles('donor'), { user: { role: 'ngo' } });
  assert.strictEqual(out.status, 403);
  assert.strictEqual(out.body.error.code, 'forbidden');
  assert.strictEqual(out.nextCalled, false);
  console.log('PASS  ngo blocked from donor-only');
}

// 2. donor allowed on donor route
{
  const out = run(requireRoles('donor'), { user: { role: 'donor' } });
  assert.strictEqual(out.status, undefined);
  assert.strictEqual(out.nextCalled, true);
  console.log('PASS  donor allowed on donor-only');
}

// 3. donor blocked from ngo route
{
  const out = run(requireRoles('ngo'), { user: { role: 'donor' } });
  assert.strictEqual(out.status, 403);
  assert.strictEqual(out.nextCalled, false);
  console.log('PASS  donor blocked from ngo-only');
}

// 4. ngo allowed on ngo route
{
  const out = run(requireRoles('ngo'), { user: { role: 'ngo' } });
  assert.strictEqual(out.nextCalled, true);
  console.log('PASS  ngo allowed on ngo-only');
}

// 5. admin blocked from donor-only and ngo-only
{
  const out1 = run(requireRoles('donor'), { user: { role: 'admin' } });
  assert.strictEqual(out1.status, 403);
  const out2 = run(requireRoles('ngo'), { user: { role: 'admin' } });
  assert.strictEqual(out2.status, 403);
  console.log('PASS  admin blocked from donor-only and ngo-only');
}

// 6. multi-role: donor|admin
{
  const out = run(requireRoles('donor', 'admin'), { user: { role: 'ngo' } });
  assert.strictEqual(out.status, 403);
  console.log('PASS  ngo blocked from donor|admin');
}

// 7. multi-role: ngo|admin — admin passes
{
  const out = run(requireRoles('ngo', 'admin'), { user: { role: 'admin' } });
  assert.strictEqual(out.nextCalled, true);
  console.log('PASS  admin allowed on ngo|admin');
}

// 8. no req.user → 401
{
  const out = run(requireRoles('donor'), {});
  assert.strictEqual(out.status, 401);
  assert.strictEqual(out.body.error.code, 'unauthenticated');
  console.log('PASS  missing req.user → 401');
}

console.log('\nAll role middleware assertions passed.');