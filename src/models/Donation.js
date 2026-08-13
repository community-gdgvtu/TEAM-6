// Donation model — a single surplus-food offering by a verified donor.
//
// Created via POST /api/donations, which is gated by requireVerifiedPartner.
// A donation is all-or-nothing in TAKI: a single NGO reserves the entire
// donation (Phase 6 sets reservedByNgoId).

const { Schema, model, Types } = require('mongoose');
const { CATEGORIES } = require('../constants/categories');

const STATUSES = ['active', 'reserved', 'completed', 'cancelled'];

const donationSchema = new Schema(
  {
    donorId: {
      type: Types.ObjectId,
      ref: 'User',
      required: [true, 'donorId is required'],
      index: true,
    },

    title: {
      type: String,
      required: [true, 'title is required'],
      trim: true,
      minlength: [2, 'title must be at least 2 characters'],
      maxlength: [100, 'title must be at most 100 characters'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [1000, 'description must be at most 1000 characters'],
    },
    category: {
      type: String,
      enum: {
        values: CATEGORIES,
        message: 'category must be one of: ' + CATEGORIES.join(', '),
      },
      required: [true, 'category is required'],
      index: true,
    },
    quantity: {
      type: Number,
      required: [true, 'quantity is required'],
      min: [1, 'quantity must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'quantity must be an integer',
      },
    },
    unit: {
      type: String,
      required: [true, 'unit is required'],
      trim: true,
      minlength: [1, 'unit must not be empty'],
      maxlength: [20, 'unit must be at most 20 characters'],
    },

    expiry: {
      type: Date,
      required: [true, 'expiry is required'],
      validate: {
        validator: (v) => v instanceof Date && v.getTime() > Date.now(),
        message: 'expiry must be in the future',
      },
    },
    pickupAddress: {
      type: String,
      required: [true, 'pickupAddress is required'],
      trim: true,
      minlength: [5, 'pickupAddress must be at least 5 characters'],
      maxlength: [300, 'pickupAddress must be at most 300 characters'],
    },
    allergens: {
      type: String,
      default: 'None',
      trim: true,
      maxlength: [300, 'allergens must be at most 300 characters'],
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [77.5946, 12.9716],
        validate: {
          validator: (v) =>
            Array.isArray(v) &&
            v.length === 2 &&
            v[0] >= -180 &&
            v[0] <= 180 &&
            v[1] >= -90 &&
            v[1] <= 90,
          message: 'coordinates must be [lng, lat]',
        },
      },
    },

    estimatedValue: {
      type: Number,
      default: 0,
      min: [0, 'estimatedValue must be >= 0'],
    },

    imageUrl: {
      type: String,
      default: null,
      maxlength: [500, 'imageUrl must be at most 500 characters'],
    },

    status: {
      type: String,
      enum: {
        values: STATUSES,
        message: 'status must be one of: ' + STATUSES.join(', '),
      },
      default: 'active',
      index: true,
    },

    reservedByNgoId: {
      type: Types.ObjectId,
      ref: 'Ngo',
      default: null,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

donationSchema.index({ createdAt: -1 });
// Required by Phase 5's nearby-donation query. Declared now so MongoDB builds
// it as soon as the Phase 4 model is used in a deployed environment.
donationSchema.index({ location: '2dsphere' });
donationSchema.index({ status: 1, expiry: 1 });
donationSchema.index({ donorId: 1, status: 1, createdAt: -1 });
donationSchema.index({ reservedByNgoId: 1, status: 1, createdAt: -1 });

const Donation = model('Donation', donationSchema);
module.exports = Donation;
module.exports.STATUSES = STATUSES;
