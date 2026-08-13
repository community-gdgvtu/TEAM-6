// Partner — a donor's business profile. Created when a donor submits
// verification info; admin flips status Pending -> Verified/Rejected.
//
// One partner profile per donor user (1:1 via `userId` unique).

const { Schema, model, Types } = require('mongoose');

const BUSINESS_TYPES = ['restaurant', 'hotel', 'event', 'catering', 'other'];
const STATUSES = ['Pending', 'Verified', 'Rejected'];

const partnerSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      unique: true,
      index: true,
    },
    businessName: {
      type: String,
      required: [true, 'businessName is required'],
      trim: true,
      minlength: [2, 'businessName must be at least 2 characters'],
      maxlength: [120, 'businessName must be at most 120 characters'],
    },
    businessType: {
      type: String,
      enum: {
        values: BUSINESS_TYPES,
        message: 'businessType must be one of: ' + BUSINESS_TYPES.join(', '),
      },
      required: [true, 'businessType is required'],
    },
    businessLicense: {
      type: String,
      required: [true, 'businessLicense is required'],
      trim: true,
      maxlength: [80, 'businessLicense must be at most 80 characters'],
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

const Partner = model('Partner', partnerSchema);

module.exports = Partner;
module.exports.BUSINESS_TYPES = BUSINESS_TYPES;
module.exports.STATUSES = STATUSES;