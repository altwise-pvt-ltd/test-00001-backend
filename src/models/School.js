// School = the tenant. Every User belongs to exactly one school (User.schoolId).
//
// A school is created together with its founding principal during auth/register
// (see auth.service.register), so `createdBy` points at that principal. Tenants
// are addressed by their ObjectId (login disambiguates by schoolId), so there is
// no separate human-friendly "code" anymore.
const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    address: {
      type: String,
      default: '',
      trim: true,
    },

    // The principal who registered this school. Nullable only transiently during
    // the registration transaction (set immediately after the principal exists).
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    deletedAt: { type: Date, default: null }, // soft delete
  },
  {
    timestamps: true,
  }
);

schoolSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('School', schoolSchema);