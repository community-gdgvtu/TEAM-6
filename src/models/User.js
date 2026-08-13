// User model — TAKI roles only (donor / ngo / admin).
// One role per account. Donor and NGO accounts each have a separate
// verification profile (see Partner/Ngo collections, added in Phase 3).
//
// As of the Phase 2.5 refactor, this model carries only auth identity.
// All product-specific profile fields (business data, NGO data) live in
// their own collections so verification status is independent of auth.

const { Schema, model } = require('mongoose');

const ROLES = ['donor', 'ngo', 'admin'];

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
      minlength: [2, 'name must be at least 2 characters'],
      maxlength: [60, 'name must be at most 60 characters'],
    },
    email: {
      type: String,
      required: [true, 'email is required'],
      lowercase: true,
      trim: true,
      // Pragmatic email shape; server-side authoritative, never security-critical.
      match: [/^\S+@\S+\.\S+$/, 'email must be a valid address'],
    },
    password: {
      // Stored as the bcrypt hash. Never returned in API responses
      // (controlled by `toJSON` below).
      type: String,
      required: [true, 'password is required'],
      minlength: [60, 'password hash looks invalid'], // bcrypt hashes are 60 chars
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ROLES,
        message: 'role must be one of: ' + ROLES.join(', '),
      },
      required: [true, 'role is required'],
    },
    // Admins deactivate accounts rather than deleting identities that may be
    // referenced by donations, profiles, and impact records.
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      // Strip sensitive fields from any object that gets serialized.
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Indexes.
// `email` is unique; declared once via schema.index to avoid the Mongoose
// "duplicate schema index" warning when combined with `unique: true` on the field.
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ role: 1, isActive: 1 });

const User = model('User', userSchema);

module.exports = User;
module.exports.ROLES = ROLES;
