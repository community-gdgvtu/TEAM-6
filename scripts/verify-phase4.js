// Dependency-free Phase 4 smoke/regression checks.
// Run: npm run verify:phase4

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { z } = require('zod');

const Donation = require('../src/models/Donation');
const { DonationCreateSchema } = require('../src/routes/donation.routes');
const { createDonation, getDonationById } = require('../src/controllers/donation.controller');
const { normalizeDonationLocation } = require('../src/middleware/donationInput');
const { validate } = require('../src/middleware/validate');
const {
  detectImageMime,
  verifyUploadedImage,
  UPLOAD_DIR,
} = require('../src/middleware/upload');

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9zQAAAABJRU5ErkJggg==',
  'base64',
);

const response = () => {
  const res = {};
  res.status = (status) => { res.statusCode = status; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

const tempFile = (name, content) => {
  const filePath = path.join(UPLOAD_DIR, `.phase4-test-${process.pid}-${name}`);
  fs.writeFileSync(filePath, content);
  return { path: filePath, filename: path.basename(filePath), mimetype: 'image/png', size: content.length };
};

const runMiddleware = (middleware, req) => {
  const res = response();
  let nextCalled = false;
  let nextError;
  middleware(req, res, (err) => { nextCalled = true; nextError = err; });
  return { res, nextCalled, nextError };
};

const validDonation = () => ({
  title: 'Fresh meals',
  description: 'Packed and ready',
  category: 'prepared-meals',
  quantity: 10,
  unit: 'meals',
  expiry: new Date(Date.now() + 60 * 60 * 1000),
  pickupAddress: '12 Market Street',
  location: { type: 'Point', coordinates: [77.5946, 12.9716] },
  estimatedValue: 250,
});

const request = (port, pathname) => new Promise((resolve, reject) => {
  http.get({ hostname: '127.0.0.1', port, path: pathname }, (res) => {
    res.resume();
    res.on('end', () => resolve(res));
  }).on('error', reject);
});

(async () => {
  // Model contract and Phase 5-ready geospatial index (no Phase 5 endpoint).
  const indexes = Donation.schema.indexes();
  assert(indexes.some(([keys]) => keys.location === '2dsphere'));
  assert.deepStrictEqual(Donation.schema.path('location.coordinates').instance, 'Array');
  console.log('PASS  donation schema includes a 2dsphere location index');

  // Image signature checks reject the previously accepted short/invalid input.
  assert.strictEqual(detectImageMime(png), 'image/png');
  assert.strictEqual(detectImageMime(Buffer.from('not an image')), null);
  assert.strictEqual(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.strictEqual(detectImageMime(Buffer.from('RIFFxxxxWEBP', 'ascii')), 'image/webp');
  console.log('PASS  JPEG, PNG, and WebP signatures are recognized; invalid content is rejected');

  const accepted = tempFile('accepted.png', png);
  let out = runMiddleware(verifyUploadedImage, { file: accepted });
  assert.strictEqual(out.nextCalled, true);
  assert.strictEqual(out.nextError, undefined);
  assert.strictEqual(fs.existsSync(accepted.path), true);
  fs.unlinkSync(accepted.path);

  const rejected = tempFile('rejected.png', Buffer.from('not an image'));
  out = runMiddleware(verifyUploadedImage, { file: rejected });
  assert.strictEqual(out.res.statusCode, 400);
  assert.strictEqual(out.res.body.error.code, 'invalid_image_content');
  assert.strictEqual(fs.existsSync(rejected.path), false);
  console.log('PASS  invalid uploaded image is rejected and removed');

  // FormData location support and all validation cleanup paths.
  const multipartReq = {
    body: {
      title: 'Fresh meals',
      description: 'Packed and ready',
      category: 'prepared-meals',
      quantity: '10',
      unit: 'meals',
      expiry: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      pickupAddress: '12 Market Street',
      location: JSON.stringify(validDonation().location),
      estimatedValue: '250',
    },
  };
  out = runMiddleware(normalizeDonationLocation, multipartReq);
  assert.strictEqual(out.nextCalled, true);
  assert.deepStrictEqual(multipartReq.body.location.coordinates, [77.5946, 12.9716]);
  assert.strictEqual(DonationCreateSchema.safeParse(multipartReq.body).success, true);

  const malformedLocationFile = tempFile('bad-location.png', png);
  out = runMiddleware(normalizeDonationLocation, {
    body: { location: '{not json' }, file: malformedLocationFile,
  });
  assert.strictEqual(out.res.statusCode, 400);
  assert.strictEqual(fs.existsSync(malformedLocationFile.path), false);

  const invalidBodyFile = tempFile('bad-body.png', png);
  out = runMiddleware(validate(z.object({ required: z.string() })), {
    body: {}, file: invalidBodyFile,
  });
  assert.strictEqual(out.res.statusCode, 400);
  assert.strictEqual(fs.existsSync(invalidBodyFile.path), false);
  console.log('PASS  JSON-string FormData location is normalized and failed body validation cleans uploads');

  // Controller ownership/defaulting and cleanup on a failed persistence call.
  const originalCreate = Donation.create;
  const originalFindById = Donation.findById;
  try {
    let persisted;
    Donation.create = async (doc) => { persisted = doc; return { _id: 'd1', ...doc }; };
    const image = tempFile('create.png', png);
    const res = response();
    await createDonation({ body: validDonation(), user: { _id: 'donor-1' }, file: image }, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(persisted.donorId, 'donor-1');
    assert.strictEqual(persisted.status, 'active');
    assert.strictEqual(persisted.imageUrl, `/uploads/${image.filename}`);
    fs.unlinkSync(image.path);

    Donation.create = async () => {
      const err = new Error('invalid');
      err.name = 'ValidationError';
      err.errors = { title: { message: 'Invalid title' } };
      throw err;
    };
    const failedImage = tempFile('create-failed.png', png);
    const failedRes = response();
    await createDonation({ body: validDonation(), user: { _id: 'donor-1' }, file: failedImage }, failedRes);
    assert.strictEqual(failedRes.statusCode, 400);
    assert.strictEqual(fs.existsSync(failedImage.path), false);

    const badIdRes = response();
    await getDonationById({ params: { id: 'bad-id' } }, badIdRes);
    assert.strictEqual(badIdRes.statusCode, 400);

    Donation.findById = async () => null;
    const missingRes = response();
    await getDonationById({ params: { id: '507f1f77bcf86cd799439011' } }, missingRes);
    assert.strictEqual(missingRes.statusCode, 404);
  } finally {
    Donation.create = originalCreate;
    Donation.findById = originalFindById;
  }
  console.log('PASS  donation creation protects server-owned fields and cleans failed persistence uploads');

  // Static delivery is deliberately cross-origin embeddable for a separate UI.
  const staticFile = path.join(UPLOAD_DIR, `phase4-static-${process.pid}.png`);
  fs.writeFileSync(staticFile, png);
  const app = require('../src/app');
  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const res = await request(server.address().port, `/uploads/${path.basename(staticFile)}`);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.headers['cross-origin-resource-policy'], 'cross-origin');
    assert.strictEqual(res.headers['access-control-allow-origin'], '*');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (fs.existsSync(staticFile)) fs.unlinkSync(staticFile);
  }
  console.log('PASS  /uploads static serving returns CORS and cross-origin embedding headers');

  console.log('\nAll Phase 4 smoke checks passed.');
})().catch((err) => {
  console.error('[verify:phase4] FAILED:', err);
  process.exitCode = 1;
});
