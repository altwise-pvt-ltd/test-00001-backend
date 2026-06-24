const mongoose = require('mongoose');
const { ASSIGNMENT_TYPE_VALUES, ASSIGNMENT_TYPES } = require('../../constant/constant');

// Assignment = the work/book a teacher gives out. It points at a
// SubjectAllocation, from which it INHERITS its scope (which teacher, which
// subject, which section). We do not duplicate teacher/subject/section here as
// the source of truth — they are derived via subjectAllocationId — but we
// denormalize sectionId + schoolId for efficient student-side querying.
const assignmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    type: {
      type: String,
      enum: ASSIGNMENT_TYPE_VALUES,
      default: ASSIGNMENT_TYPES.HOMEWORK,
    },

    // simple attachment refs (book name / file URL). File storage itself is
    // out of scope for now; this just holds references.
    attachments: {
      type: [String],
      default: [],
    },

    dueDate: {
      type: Date,
      default: null,
    },

    // ---- authority + scope source ----
    subjectAllocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubjectAllocation',
      required: true,
      index: true,
    },

    // denormalized for fast "assignments for my section" queries
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true,
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

// student-facing query: "assignments for my section, newest first"
assignmentSchema.index({ schoolId: 1, sectionId: 1, createdAt: -1 });

module.exports = mongoose.model('Assignment', assignmentSchema);