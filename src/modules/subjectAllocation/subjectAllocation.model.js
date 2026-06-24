const mongoose = require('mongoose');

// SubjectAllocation is the AUTHORITY JOIN: "Teacher T teaches Subject S to
// Section X" — one row per fact. A teacher teaching many subjects/sections
// simply has many rows. A teacher can only create Assignments that reference one
// of their own SubjectAllocations — so authorization falls out of the data model
// rather than being a separate set of rules.
const subjectAllocationSchema = new mongoose.Schema(
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
    // classId is DERIVED from the section on write (a section belongs to exactly
    // one class) and stored here for direct querying/display — "which classes
    // does this teacher take?" — without a section join. The service keeps it in
    // lock-step with sectionId so the two can never disagree; classId is NEVER
    // trusted from the client, always recomputed from the section.
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
      index: true,
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

// One teacher is allocated to a given subject+section at most once.
subjectAllocationSchema.index(
  { teacherId: 1, subjectId: 1, sectionId: 1 },
  { unique: true }
);

// fast lookup: "who teaches this subject to this section?"
subjectAllocationSchema.index({ schoolId: 1, sectionId: 1, subjectId: 1 });

module.exports = mongoose.model('SubjectAllocation', subjectAllocationSchema);
