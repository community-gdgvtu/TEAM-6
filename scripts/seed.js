// Idempotent Phase 9 demo seed. Creates the complete TAKI story:
// verified donor + verified NGO + admin, one completed rescue with impact,
// and one active donation ready to reserve during a live demonstration.
// Run: npm run seed

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Partner = require('../src/models/Partner');
const Ngo = require('../src/models/Ngo');
const Donation = require('../src/models/Donation');
const Impact = require('../src/models/Impact');
const { hashPassword } = require('../src/utils/password');
const { required } = require('../src/config/env');

const PASSWORD = 'DemoPass123!';
const accounts = [
  { name: 'TAKI Demo Admin', email: 'admin@taki.demo', role: 'admin' },
  { name: 'Demo Donor', email: 'donor@taki.demo', role: 'donor' },
  { name: 'Demo NGO', email: 'ngo@taki.demo', role: 'ngo' },
];

const upsertUser = async ({ name, email, role }) => {
  let user = await User.findOne({ email }).select('+password');
  if (!user) {
    user = await User.create({ name, email, role, password: await hashPassword(PASSWORD), isActive: true });
  } else if (user.isActive === false) {
    user.isActive = true;
    await user.save();
  }
  return user;
};

(async () => {
  try {
    await mongoose.connect(required('MONGODB_URI'));
    const [admin, donor, ngoUser] = await Promise.all(accounts.map(upsertUser));

    const partner = await Partner.findOneAndUpdate(
      { userId: donor._id },
      {
        $set: {
          businessName: 'Demo Community Kitchen', businessType: 'restaurant',
          businessLicense: 'TAKI-DEMO-001', address: '12 Market Street, Bengaluru',
          contactNumber: '+919000000001', status: 'Verified', reviewedBy: admin._id,
          reviewedAt: new Date(), rejectionReason: null,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    const ngo = await Ngo.findOneAndUpdate(
      { userId: ngoUser._id },
      {
        $set: {
          ngoName: 'Demo Food Relief Network', registrationNumber: 'TAKI-NGO-001',
          address: '45 Service Road, Bengaluru', contactNumber: '+919000000002',
          focalPersonName: 'Demo Coordinator', focalPersonContact: '+919000000003',
          status: 'Verified', reviewedBy: admin._id, reviewedAt: new Date(), rejectionReason: null,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    const completed = await Donation.findOneAndUpdate(
      { title: 'DEMO COMPLETED: Fresh Vegetable Meals', donorId: donor._id },
      {
        $set: {
          description: 'Completed demo rescue for impact dashboard.', category: 'prepared-meals', quantity: 25,
          unit: 'meals', expiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
          pickupAddress: '12 Market Street, Bengaluru', location: { type: 'Point', coordinates: [77.5946, 12.9716] },
          estimatedValue: 2500, status: 'completed', reservedByNgoId: ngo._id,
          imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
          allergens: 'None',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    await Impact.findOneAndUpdate(
      { donationId: completed._id },
      {
        $set: {
          donorId: donor._id, ngoId: ngo._id, category: completed.category, quantity: completed.quantity,
          unit: completed.unit, estimatedValue: completed.estimatedValue, completedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    await Donation.findOneAndUpdate(
      { title: 'DEMO ACTIVE: Bakery Surplus for Pickup', donorId: donor._id },
      {
        $set: {
          description: 'Reserve this active bakery surplus donation during live demonstration.', category: 'bakery', quantity: 18,
          unit: 'items', expiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
          pickupAddress: '12 Market Street, Bengaluru', location: { type: 'Point', coordinates: [77.5946, 12.9716] },
          estimatedValue: 900, status: 'active', reservedByNgoId: null,
          imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
          allergens: 'Contains Gluten, Wheat, Butter',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    await Donation.findOneAndUpdate(
      { title: 'Paneer Biryani & Curry Feast', donorId: donor._id },
      {
        $set: {
          description: 'Authentic aromatic Paneer Dum Biryani prepared fresh today.', category: 'prepared-meals', quantity: 15,
          unit: 'portions', expiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
          pickupAddress: '12 Market Street, Bengaluru', location: { type: 'Point', coordinates: [77.5946, 12.9716] },
          estimatedValue: 1200, status: 'active', reservedByNgoId: null,
          imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
          allergens: 'Contains Dairy, Spices',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    await Donation.findOneAndUpdate(
      { title: 'Artisanal Sourdough & Croissant Basket', donorId: donor._id },
      {
        $set: {
          description: 'Freshly baked sourdough loaves, butter croissants and pastries.', category: 'bakery', quantity: 20,
          unit: 'items', expiry: new Date(Date.now() + 18 * 60 * 60 * 1000),
          pickupAddress: '12 Market Street, Bengaluru', location: { type: 'Point', coordinates: [77.5946, 12.9716] },
          estimatedValue: 800, status: 'active', reservedByNgoId: null,
          imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
          allergens: 'Contains Gluten, Wheat, Butter',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    await Donation.findOneAndUpdate(
      { title: 'Garden Fresh Fruit & Produce Crate', donorId: donor._id },
      {
        $set: {
          description: 'Organic apples, oranges, berries and fresh garden produce.', category: 'produce', quantity: 12,
          unit: 'kg', expiry: new Date(Date.now() + 48 * 60 * 60 * 1000),
          pickupAddress: '12 Market Street, Bengaluru', location: { type: 'Point', coordinates: [77.5946, 12.9716] },
          estimatedValue: 650, status: 'active', reservedByNgoId: null,
          imageUrl: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=600&q=80',
          allergens: 'None',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    console.log('[seed] Demo data is ready.');
    console.log(`[seed] Admin:  admin@taki.demo / ${PASSWORD}`);
    console.log(`[seed] Donor:  donor@taki.demo / ${PASSWORD}`);
    console.log(`[seed] NGO:    ngo@taki.demo / ${PASSWORD}`);
    console.log(`[seed] Verified partner profile: ${partner._id}`);
    console.log(`[seed] Verified NGO profile: ${ngo._id}`);
    console.log(`[seed] Completed donation + impact: ${completed._id}`);
  } catch (err) {
    console.error('[seed] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
