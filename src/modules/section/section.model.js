const mongoose = require('mongoose');

// Section = a division within a Class, e.g. "A" inside "Class 5" -> 5-A.
// Belongs to exactly one Class. Students and TeachingAssignments point here.
const sectionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true, // "A", "B"  (display as "5-A" by combining with the class)
    },

    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
      index: true,
    },

    // TENANT key (denormalized from Class so every query can fence by schoolId
    // directly without a join — standard multi-tenant practice)
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

// Section name unique within its class (no two "A" sections in Class 5).
sectionSchema.index({ classId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Section', sectionSchema);