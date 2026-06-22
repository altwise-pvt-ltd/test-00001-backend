const mongoose = require('mongoose');

// TeachingAssignment is the AUTHORITY JOIN: "Teacher T teaches Subject S to
// Section X". A teacher can only create Assignments that reference one of their
// own TeachingAssignments — so authorization falls out of the data model
// rather than being a separate set of rules.
const teachingAssignmentSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // must be a user with role 'teacher' (validated in service)
      required: true,
      index: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
    },

    // TENANT key (denormalized for direct fencing)
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

// One teacher is assigned to a given subject+section at most once.
teachingAssignmentSchema.index(
  { teacherId: 1, subjectId: 1, sectionId: 1 },
  { unique: true }
);

// fast lookup: "who teaches this subject to this section?"
teachingAssignmentSchema.index({ schoolId: 1, sectionId: 1, subjectId: 1 });

module.exports = mongoose.model('TeachingAssignment', teachingAssignmentSchema);