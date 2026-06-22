const mongoose = require('mongoose');

// Subject = a taught subject, e.g. "Mathematics". Owned by a school.
// Teachers are linked to subjects (per section) via TeachingAssignment.
const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true, // "Mathematics"
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      default: '', // optional short code, e.g. "MATH"
    },

    // TENANT key
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
      index: true,
    },

    // audit / lifecycle
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Subject name unique within a school.
subjectSchema.index({ schoolId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Subject', subjectSchema);