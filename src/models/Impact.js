// Immutable rescue outcome created when a donor completes a reservation.

const { Schema, model, Types } = require('mongoose');
const { CATEGORIES } = require('../constants/categories');

const impactSchema = new Schema(
  {
    donationId: {
      type: Types.ObjectId,
      ref: 'Donation',
      required: [true, 'donationId is required'],
      unique: true,
      index: true,
    },
    donorId: {
      type: Types.ObjectId,
      ref: 'User',
      required: [true, 'donorId is required'],
      index: true,
    },
    ngoId: {
      type: Types.ObjectId,
      ref: 'Ngo',
      required: [true, 'ngoId is required'],
      index: true,
    },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, required: true, maxlength: 20 },
    estimatedValue: { type: Number, required: true, min: 0 },
    completedAt: { type: Date, required: true, default: Date.now, index: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { transform: (_doc, ret) => { delete ret.__v; return ret; } },
  },
);

impactSchema.index({ donorId: 1, completedAt: -1 });
impactSchema.index({ ngoId: 1, completedAt: -1 });
impactSchema.index({ category: 1, completedAt: -1 });

module.exports = model('Impact', impactSchema);
