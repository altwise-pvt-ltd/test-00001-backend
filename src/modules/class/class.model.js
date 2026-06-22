const mongoose = require('mongoose');
const { CLASS_LEVELS } = require('../../constant/constant');

// Class = the grade level, identified by a canonical number (1..12) from
// CLASS_LEVELS rather than a free-text name — so "grade 5" is the same key in
// every school. A Class contains multiple Sections (5-A, 5-B). A student
// belongs to exactly one Class and one Section within it. Render a display
// label ("Class 5") in the app layer from `level`.
const classSchema = new mongoose.Schema(
  {
    level: {
      type: Number,
      required: true,
      enum: CLASS_LEVELS, // 1..12, validated against the shared constant
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

// A class level is unique within a school (no two "grade 5" rows in one school).
classSchema.index({ schoolId: 1, level: 1 }, { unique: true });

module.exports = mongoose.model('Class', classSchema);