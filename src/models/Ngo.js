// Ngo — an NGO's verification profile. Created when an ngo user submits
// verification info; admin flips status Pending -> Verified/Rejected.
//
// One ngo profile per ngo user (1:1 via `userId` unique).

const { Schema, model, Types } = require('mongoose');

const STATUSES = ['Pending', 'Verified', 'Rejected'];

const ngoSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      unique: true,
      index: true,
    },
    ngoName: {
      type: String,
      required: [true, 'ngoName is required'],
      trim: true,
      minlength: [2, 'ngoName must be at least 2 characters'],
      maxlength: [120, 'ngoName must be at most 120 characters'],
    },
    registrationNumber: {
      type: String,
      required: [true, 'registrationNumber is required'],
      trim: true,
      maxlength: [80, 'registrationNumber must be at most 80 characters'],
    },
    address: {
      type: String,
      required: [true, 'address is required'],
      trim: true,
      maxlength: [300, 'address must be at most 300 characters'],
    },
    contactNumber: {
      type: String,
      required: [true, 'contactNumber is required'],
      trim: true,
      minlength: [7, 'contactNumber must be at least 7 characters'],
      maxlength: [20, 'contactNumber must be at most 20 characters'],
    },
    focalPersonName: {
      type: String,
      required: [true, 'focalPersonName is required'],
      trim: true,
      minlength: [2, 'focalPersonName must be at least 2 characters'],
      maxlength: [80, 'focalPersonName must be at most 80 characters'],
    },
    focalPersonContact: {
      type: String,
      required: [true, 'focalPersonContact is required'],
      trim: true,
      minlength: [7, 'focalPersonContact must be at least 7 characters'],
      maxlength: [20, 'focalPersonContact must be at most 20 characters'],
    },
    status: {
      type: String,
      enum: {
        values: STATUSES,
        message: 'status must be one of: ' + STATUSES.join(', '),
      },
      default: 'Pending',
      index: true,
    },
    reviewedBy: {
      type: Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
      maxlength: [500, 'rejectionReason must be at most 500 characters'],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  },
);

const Ngo = model('Ngo', ngoSchema);

module.exports = Ngo;
module.exports.STATUSES = STATUSES;